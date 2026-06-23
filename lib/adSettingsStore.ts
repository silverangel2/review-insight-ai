import { promises as fs } from "fs";
import path from "path";
import { defaultAdSettings, type AdSettings } from "@/lib/adConfig";

export type LiveAdSettings = AdSettings & {
  placeholderAdsEnabled: boolean;
};

const settingsPath = path.join(process.cwd(), "data", "ad-settings.json");

export const defaultLiveAdSettings: LiveAdSettings = {
  ...defaultAdSettings,
  adsEnabled: true,
  directSponsorAdsEnabled: true,
  googleAdsEnabled: false,
  placeholderAdsEnabled: true,
};

export async function readAdSettings(): Promise<LiveAdSettings> {
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const saved = JSON.parse(raw) as Partial<LiveAdSettings>;

    return {
      ...defaultLiveAdSettings,
      ...saved,
      placements: {
        ...defaultLiveAdSettings.placements,
        ...(saved.placements ?? {}),
      },
    };
  } catch {
    return defaultLiveAdSettings;
  }
}

export async function writeAdSettings(settings: Partial<LiveAdSettings>) {
  const current = await readAdSettings();

  const next: LiveAdSettings = {
    ...current,
    ...settings,
    placements: {
      ...current.placements,
      ...(settings.placements ?? {}),
    },
  };

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(next, null, 2), "utf8");

  return next;
}
