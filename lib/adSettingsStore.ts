import { promises as fs } from "fs";
import path from "path";
import {
  defaultAdSettings,
  defaultAffiliatePartnerSettings,
  managedAffiliatePartners,
  type AdSettings,
  type AffiliatePartnerSettings,
  type ManagedAffiliatePartner,
} from "@/lib/adConfig";

export type LiveAdSettings = AdSettings & {
  placeholderAdsEnabled: boolean;
};

const settingsPath = path.join(process.cwd(), "data", "ad-settings.json");

type PartialAffiliatePartnerSettings = Partial<
  Record<ManagedAffiliatePartner, Partial<AffiliatePartnerSettings>>
>;

export const defaultLiveAdSettings: LiveAdSettings = {
  ...defaultAdSettings,
  adsEnabled: true,
  directSponsorAdsEnabled: true,
  googleAdsEnabled: false,
  placeholderAdsEnabled: true,
};

function mergeAffiliatePartners(
  base: Record<ManagedAffiliatePartner, AffiliatePartnerSettings>,
  next?: PartialAffiliatePartnerSettings,
): Record<ManagedAffiliatePartner, AffiliatePartnerSettings> {
  return managedAffiliatePartners.reduce<Record<ManagedAffiliatePartner, AffiliatePartnerSettings>>(
    (merged, partner) => {
      const current = base[partner] ?? defaultAffiliatePartnerSettings[partner];
      const incoming = next?.[partner];

      merged[partner] = {
        ...current,
        ...(incoming ?? {}),
        placements: {
          ...current.placements,
          ...(incoming?.placements ?? {}),
        },
      };

      return merged;
    },
    {} as Record<ManagedAffiliatePartner, AffiliatePartnerSettings>,
  );
}

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
      affiliatePartners: mergeAffiliatePartners(
        defaultLiveAdSettings.affiliatePartners,
        saved.affiliatePartners as PartialAffiliatePartnerSettings | undefined,
      ),
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
    affiliatePartners: mergeAffiliatePartners(
      current.affiliatePartners,
      settings.affiliatePartners as PartialAffiliatePartnerSettings | undefined,
    ),
  };

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(next, null, 2), "utf8");

  return next;
}
