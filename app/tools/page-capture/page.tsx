import type { Metadata } from "next";
import { privatePage } from "@/lib/pageSeo";
import { CaptureClient } from "./CaptureClient";

export const metadata: Metadata = privatePage("/tools/page-capture", "Your scan");

export const dynamic = "force-dynamic";

export default function PageCapturePage() {
  return <CaptureClient />;
}
