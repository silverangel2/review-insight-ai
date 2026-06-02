import type { ServerAccount } from "@/lib/supabaseServer";

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

const settingsStore = ((globalThis as typeof globalThis & { __reviewintelAppSettings?: RuntimeAppSettings }).__reviewintelAppSettings ??= {
  ...DEFAULT_APP_SETTINGS
});

export function getRuntimeAppSettings() {
  return settingsStore;
}

export function updateRuntimeAppSettings(next: Partial<RuntimeAppSettings>) {
  Object.assign(settingsStore, next);
  return settingsStore;
}

export function canManageAppSettings(account: ServerAccount) {
  return account.role === "admin";
}
