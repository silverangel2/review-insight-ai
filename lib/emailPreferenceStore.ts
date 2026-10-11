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

function fromRow(row: ProfileRow, columnsReady: boolean): StoredEmailPrefs {
  const productUpdates = columnsReady && row.email_product_updates !== null && row.email_product_updates !== undefined
    ? Boolean(row.email_product_updates)
    : Boolean(row.marketing_consent);
  const upgradeTips = columnsReady && row.email_upgrade_tips !== null && row.email_upgrade_tips !== undefined
    ? Boolean(row.email_upgrade_tips)
    : true;
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
    return row ? fromRow(row, true) : { email, found: false, columnsReady: true, productUpdates: false, upgradeTips: true };
  }
  if (full.status !== 400) return null;
  const basic = await readRows(email, BASIC_SELECT);
  if (!basic.ok) return null;
  const row = basic.rows[0];
  return row ? fromRow(row, false) : { email, found: false, columnsReady: false, productUpdates: false, upgradeTips: true };
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
  const full = await supabaseUpdate("profiles", `email=eq.${encodeURIComponent(email)}`, {
    marketing_consent: prefs.productUpdates,
    email_product_updates: prefs.productUpdates,
    email_upgrade_tips: prefs.upgradeTips,
    updated_at: now,
  });
  if (updatedRows(full)) return { ok: true, columnsReady: true, reason: "saved" as const };
  const basic = await supabaseUpdate("profiles", `email=eq.${encodeURIComponent(email)}`, {
    marketing_consent: prefs.productUpdates,
    updated_at: now,
  });
  if (updatedRows(basic)) return { ok: true, columnsReady: false, reason: "saved-basic" as const };
  return { ok: false, columnsReady: false, reason: "missing" as const };
}
