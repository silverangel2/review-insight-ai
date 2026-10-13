import { notFound } from "next/navigation";
import { ScanProgressPreview } from "./preview";

// Development-only preview of the live scan overlay. It polls the real
// /api/scan-progress endpoint; tests/screenshots mock that endpoint.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ScanProgressPreview />;
}
