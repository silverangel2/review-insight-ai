import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type AdminSeoDraft = Record<string, unknown>;
export type AdminSeoSettings = Record<string, AdminSeoDraft>;

const SETTINGS_PATH = path.join(process.cwd(), "data", "admin-seo-settings.json");
const TABLE = "admin_seo_settings";

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function supabaseServiceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    ""
  );
}

export function hasAdminSeoDatabase() {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

function supabaseHeaders() {
  const key = supabaseServiceKey();

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function readLocalSeoSettings(): Promise<AdminSeoSettings> {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as AdminSeoSettings;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeLocalSeoSettings(settings: AdminSeoSettings) {
  await mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
}

export async function readAdminSeoSettings(): Promise<{
  settings: AdminSeoSettings;
  source: "supabase" | "local-json";
}> {
  if (!hasAdminSeoDatabase()) {
    return { settings: await readLocalSeoSettings(), source: "local-json" };
  }

  const response = await fetch(`${supabaseUrl()}/rest/v1/${TABLE}?select=path,draft`, {
    method: "GET",
    headers: supabaseHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    // If the Supabase table has not been created yet, keep admin SEO usable
    // with local defaults instead of crashing the readiness checker.
    if (response.status === 404) {
      return { settings: await readLocalSeoSettings(), source: "local-json" };
    }

    throw new Error(`Supabase SEO settings read failed: ${response.status}`);
  }

  const rows = (await response.json()) as Array<{ path: string; draft: AdminSeoDraft }>;
  const settings: AdminSeoSettings = {};

  for (const row of rows) {
    if (row.path) settings[row.path] = row.draft || {};
  }

  if (Object.keys(settings).length === 0) {
    const localDefaults = await readLocalSeoSettings();
    if (Object.keys(localDefaults).length > 0) {
      await saveAdminSeoSettings(localDefaults);
      return { settings: localDefaults, source: "supabase" };
    }
  }

  return { settings, source: "supabase" };
}

export async function saveAdminSeoSettings(settings: AdminSeoSettings): Promise<{
  settings: AdminSeoSettings;
  source: "supabase" | "local-json";
}> {
  if (!hasAdminSeoDatabase()) {
    await writeLocalSeoSettings(settings);
    return { settings, source: "local-json" };
  }

  const rows = Object.entries(settings).map(([seoPath, draft]) => ({
    path: seoPath,
    draft,
    updated_at: new Date().toISOString(),
  }));

  const response = await fetch(`${supabaseUrl()}/rest/v1/${TABLE}?on_conflict=path`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");

    // If table is missing locally, do not fake success as Supabase.
    // Save to local JSON fallback and keep deploymentReady=false.
    if (response.status === 404) {
      await writeLocalSeoSettings(settings);
      return { settings, source: "local-json" };
    }

    throw new Error(`Supabase SEO settings save failed: ${response.status} ${message}`);
  }

  return { settings, source: "supabase" };
}

export async function saveAdminSeoDraft(
  seoPath: string,
  draft: AdminSeoDraft,
  existingSettings?: AdminSeoSettings
) {
  const current = existingSettings || (await readAdminSeoSettings()).settings;
  const next = {
    ...current,
    [seoPath]: draft,
  };

  return saveAdminSeoSettings(next);
}
