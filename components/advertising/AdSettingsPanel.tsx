"use client";

import { useEffect, useState } from "react";
import type { AdPlacement } from "@/lib/adConfig";
import type { LiveAdSettings } from "@/lib/adSettingsStore";

const placementLabels: Record<AdPlacement, string> = {
  homepage_hero: "Homepage hero",
  homepage_mid: "Homepage middle",
  analyze_below_card: "Analyze page",
  analyze_premium_top: "$99 Analyze premium top",
  analyze_premium_bottom: "$99 Analyze premium bottom",
  results_below_verdict: "Results page",
  buyer_dashboard: "Buyer dashboard",
  seller_dashboard: "Seller dashboard",
  footer: "Footer",
};

function ToggleButton({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`rounded-2xl border p-4 text-left transition ${
        value
          ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-300/40 dark:bg-emerald-300/10 dark:text-emerald-100"
          : "border-line bg-white text-slate-600 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.2em]">
        {value ? "ON" : "OFF"}
      </p>
      <p className="mt-2 text-base font-black">{label}</p>
    </button>
  );
}

export function AdSettingsPanel() {
  const [settings, setSettings] = useState<LiveAdSettings | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadSettings() {
    const response = await fetch("/api/advertising/settings", { cache: "no-store" });
    const data = await response.json();
    setSettings(data.settings);
  }

  async function saveSettings(next: Partial<LiveAdSettings>) {
    if (!settings) return;

    const merged = {
      ...settings,
      ...next,
      placements: {
        ...settings.placements,
        ...(next.placements ?? {}),
      },
    };

    setSettings(merged);
    setSaving(true);

    try {
      const response = await fetch("/api/advertising/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });

      const data = await response.json();
      setSettings(data.settings);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  if (!settings) {
    return (
      <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04]">
        <p className="text-slate-600 dark:text-slate-300">Loading ad controls...</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-ocean dark:text-cyan-200">
            Live Ad Controls
          </p>
          <h2 className="mt-2 text-2xl font-black">Turn advertising on or off anytime</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            These controls affect the visible ad slots on ReviewIntel without changing code.
          </p>
        </div>

        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          {saving ? "Saving..." : "Saved"}
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <ToggleButton
          label="Global ads"
          value={settings.adsEnabled}
          onChange={(value) => saveSettings({ adsEnabled: value })}
        />

        <ToggleButton
          label="Direct sponsors"
          value={settings.directSponsorAdsEnabled}
          onChange={(value) => saveSettings({ directSponsorAdsEnabled: value })}
        />

        <ToggleButton
          label="Google AdSense"
          value={settings.googleAdsEnabled}
          onChange={(value) => saveSettings({ googleAdsEnabled: value })}
        />

        <ToggleButton
          label="Placeholder ads"
          value={settings.placeholderAdsEnabled}
          onChange={(value) => saveSettings({ placeholderAdsEnabled: value })}
        />
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-black">Placement controls</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Turn specific ad locations on or off.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(Object.keys(placementLabels) as AdPlacement[]).map((placement) => (
            <ToggleButton
              key={placement}
              label={placementLabels[placement]}
              value={Boolean(settings.placements[placement])}
              onChange={(value) =>
                saveSettings({
                  placements: {
                    ...settings.placements,
                    [placement]: value,
                  },
                })
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
