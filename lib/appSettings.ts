import type { ServerAccount } from "@/lib/supabaseServer";
import { supabaseSelect, supabaseUpsert } from "@/lib/supabaseServer";

export type RuntimeAppSettings = {
  maintenance_mode: boolean;
  allow_new_signups: boolean;
  ai_enabled: boolean;
  payments_enabled: boolean;
  sponsored_section_enabled: boolean;
  announcement_enabled: boolean;
  announcement_text: string;
  stripe_sandbox_mode: boolean;
};

export const DEFAULT_APP_SETTINGS: RuntimeAppSettings = {
  maintenance_mode: false,
  allow_new_signups: true,
  ai_enabled: true,
  payments_enabled: true,
  sponsored_section_enabled: true,
  announcement_enabled: false,
  announcement_text: "ReviewIntel is temporarily updating. Please check back shortly.",
  stripe_sandbox_mode: true
};

type AppSettingsRow = {
  key?: string | null;
  value?: unknown;
};

const SETTINGS_ROW_KEY = "runtime";

function normalizeSettings(input: unknown): RuntimeAppSettings {
  const source = (input ?? {}) as Partial<RuntimeAppSettings>;

  return {
    maintenance_mode:
      typeof source.maintenance_mode === "boolean"
        ? source.maintenance_mode
        : DEFAULT_APP_SETTINGS.maintenance_mode,
    allow_new_signups:
      typeof source.allow_new_signups === "boolean"
        ? source.allow_new_signups
        : DEFAULT_APP_SETTINGS.allow_new_signups,
    ai_enabled:
      typeof source.ai_enabled === "boolean"
        ? source.ai_enabled
        : DEFAULT_APP_SETTINGS.ai_enabled,
    payments_enabled:
      typeof source.payments_enabled === "boolean"
        ? source.payments_enabled
        : DEFAULT_APP_SETTINGS.payments_enabled,
    sponsored_section_enabled:
      typeof source.sponsored_section_enabled === "boolean"
        ? source.sponsored_section_enabled
        : DEFAULT_APP_SETTINGS.sponsored_section_enabled,
    announcement_enabled:
      typeof source.announcement_enabled === "boolean"
        ? source.announcement_enabled
        : DEFAULT_APP_SETTINGS.announcement_enabled,
    announcement_text:
      typeof source.announcement_text === "string"
        ? source.announcement_text.slice(0, 240)
        : DEFAULT_APP_SETTINGS.announcement_text,
    stripe_sandbox_mode:
      typeof source.stripe_sandbox_mode === "boolean"
        ? source.stripe_sandbox_mode
        : DEFAULT_APP_SETTINGS.stripe_sandbox_mode
  };
}

export async function getRuntimeAppSettings(): Promise<RuntimeAppSettings> {
  const rows = await supabaseSelect<AppSettingsRow>(
    "app_settings",
    `select=key,value&key=eq.${SETTINGS_ROW_KEY}&limit=1`
  );

  const row = rows[0];

  if (!row) {
    return DEFAULT_APP_SETTINGS;
  }

  return normalizeSettings(row.value);
}

export async function updateRuntimeAppSettings(
  next: Partial<RuntimeAppSettings>
): Promise<RuntimeAppSettings> {
  const current = await getRuntimeAppSettings();
  const merged = normalizeSettings({ ...current, ...next });

  await supabaseUpsert(
    "app_settings",
    {
      key: SETTINGS_ROW_KEY,
      value: merged,
      updated_at: new Date().toISOString()
    },
    "key"
  );

  return merged;
}

export function canManageAppSettings(account: ServerAccount) {
  return account.role === "admin";
}
