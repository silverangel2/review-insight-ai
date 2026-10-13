import { isSupabaseConfigured, supabaseCount, supabaseFetch, supabaseUpdate } from "@/lib/supabaseServer";
import { normalizeMailbox } from "@/lib/emailLinks";

export type StoredEmailPrefs = {
  email: string;
  name?: string | null;
  role?: string | null;
  plan?: string | null;
  productUpdates: boolean;
  upgradeTips: boolean;
  welcomeSentAt?: string | null;
  upgradeSentAt?: string | null;
  found: boolean;
  columnsReady: boolean;
};

type ProfileRow = {
  email?: string | null;
  name?: string | null;
  role?: string | null;
  plan?: string | null;
  marketing_consent?: boolean | null;
  email_product_updates?: boolean | null;
  email_upgrade_tips?: boolean | null;
  welcome_email_sent_at?: string | null;
  first_scan_upgrade_sent_at?: string | null;
};

const FULL_SELECT = "email,name,role,plan,marketing_consent,email_product_updates,email_upgrade_tips,welcome_email_sent_at,first_scan_upgrade_sent_at";
const BASIC_SELECT = "email,name,role,plan,marketing_consent";

/**
 * Marketing permission rules (fail closed):
 * - marketing_consent is the master switch. It is the box people tick at signup
 *   ("Email me product updates and ReviewIntel tips"), so it covers both product
 *   updates and upgrade tips. Anything other than an explicit `true` means NO.
 * - email_product_updates / email_upgrade_tips can only narrow that permission.
 *   An explicit `false` always wins. `null` (column added but never set) inherits
 *   the master switch, because the signup wording is the same permission.
 * - Because both must agree, an opt-out written by older code (marketing_consent
 *   only) or by this code (both columns) survives rollback and re-upgrade.
 * - No row, or unknown values, means do not send.
 * Account, billing and security mail never reads these flags.
 */
export function marketingPermission(row: ProfileRow, columnsReady: boolean) {
  const master = row.marketing_consent === true;
  const narrow = (value: boolean | null | undefined) =>
    master && (!columnsReady || value === null || value === undefined ? true : value === true);
  return { productUpdates: narrow(row.email_product_updates), upgradeTips: narrow(row.email_upgrade_tips) };
}

function fromRow(row: ProfileRow, columnsReady: boolean): StoredEmailPrefs {
  const { productUpdates, upgradeTips } = marketingPermission(row, columnsReady);
  return {
    email: normalizeMailbox(row.email),
    name: row.name || "",
    role: row.role || "buyer",
    plan: row.plan || "free_buyer",
    productUpdates,
    upgradeTips,
    welcomeSentAt: columnsReady ? row.welcome_email_sent_at || null : null,
    upgradeSentAt: columnsReady ? row.first_scan_upgrade_sent_at || null : null,
    found: true,
    columnsReady,
  };
}

async function readRows(email: string, select: string) {
  const response = await supabaseFetch(
    `/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=${select}&limit=1`
  );
  if (!response.ok) return { ok: false as const, status: response.status, rows: [] as ProfileRow[] };
  const rows = await response.json().catch(() => []);
  return { ok: true as const, status: response.status, rows: Array.isArray(rows) ? rows as ProfileRow[] : [] };
}

export async function readStoredEmailPrefs(emailInput: string): Promise<StoredEmailPrefs | null> {
  const email = normalizeMailbox(emailInput);
  if (!email || !isSupabaseConfigured()) return null;
  const full = await readRows(email, FULL_SELECT);
  if (full.ok) {
    const row = full.rows[0];
    return row ? fromRow(row, true) : { email, found: false, columnsReady: true, productUpdates: false, upgradeTips: false };
  }
  if (full.status !== 400) return null;
  const basic = await readRows(email, BASIC_SELECT);
  if (!basic.ok) return null;
  const row = basic.rows[0];
  return row ? fromRow(row, false) : { email, found: false, columnsReady: false, productUpdates: false, upgradeTips: false };
}

function updatedRows(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

export async function claimEmailStamp(emailInput: string, column: "welcome_email_sent_at" | "first_scan_upgrade_sent_at") {
  const email = normalizeMailbox(emailInput);
  if (!email || !isSupabaseConfigured()) return false;
  const now = new Date().toISOString();
  const updated = await supabaseUpdate(
    "profiles",
    `email=eq.${encodeURIComponent(email)}&${column}=is.null`,
    { [column]: now, updated_at: now }
  );
  return updatedRows(updated);
}

export async function countAnalysisEvents(emailInput: string) {
  const email = normalizeMailbox(emailInput);
  if (!email || !isSupabaseConfigured()) return 0;
  return supabaseCount(
    "usage_events",
    `select=id&profile_email=eq.${encodeURIComponent(email)}&event_type=eq.analysis`
  );
}

export async function saveEmailPrefs(emailInput: string, prefs: { productUpdates: boolean; upgradeTips: boolean }) {
  const email = normalizeMailbox(emailInput);
  if (!email) return { ok: false, columnsReady: false, reason: "invalid" as const };
  if (!isSupabaseConfigured()) return { ok: false, columnsReady: false, reason: "not-configured" as const };
  const now = new Date().toISOString();
  // The master switch stays on only while at least one marketing type is wanted.
  const anyMarketing = prefs.productUpdates === true || prefs.upgradeTips === true;
  const full = await supabaseUpdate("profiles", `email=eq.${encodeURIComponent(email)}`, {
    marketing_consent: anyMarketing,
    email_product_updates: prefs.productUpdates,
    email_upgrade_tips: prefs.upgradeTips,
    updated_at: now,
  });
  if (updatedRows(full)) return { ok: true, columnsReady: true, reason: "saved" as const };
  const basic = await supabaseUpdate("profiles", `email=eq.${encodeURIComponent(email)}`, {
    marketing_consent: anyMarketing,
    updated_at: now,
  });
  if (updatedRows(basic)) return { ok: true, columnsReady: false, reason: "saved-basic" as const };
  return { ok: false, columnsReady: false, reason: "missing" as const };
}
