"use client";
import { trackTrafficEvent } from "@/lib/clientTraffic";

export function TrackedBuyLink({ href, label, productName, source }: { href: string; label: string; productName: string; source: string }) {
  return (
    <a href={href} target="_blank" rel="sponsored noopener noreferrer"
      onClick={() => trackTrafficEvent({ eventType: "affiliate_click", metadata: { source, kind: "buy_scanned", provider: "amazon", productName } })}
      className="ri-lift inline-flex w-full items-center justify-center rounded-full bg-teal px-5 py-3 text-sm font-semibold text-white">
      {label}
    </a>
  );
}
