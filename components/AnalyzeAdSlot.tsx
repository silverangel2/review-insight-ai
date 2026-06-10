"use client";

import { AdSlot } from "@/components/advertising/AdSlot";
import type { AdPlacement } from "@/lib/adConfig";

type AnalyzeAdSlotProps = {
  placement?: "analyze-hero" | "analyze-sidebar-top" | "analyze-sidebar-bottom";
};

const placementMap: Record<NonNullable<AnalyzeAdSlotProps["placement"]>, AdPlacement> = {
  "analyze-hero": "analyze_below_card",
  "analyze-sidebar-top": "analyze_premium_top",
  "analyze-sidebar-bottom": "analyze_premium_bottom"
};

export function AnalyzeAdSlot({ placement = "analyze-hero" }: AnalyzeAdSlotProps) {
  return (
    <AdSlot
      placement={placementMap[placement]}
      compact
      className="rounded-[2rem]"
    />
  );
}
