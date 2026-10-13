import { ImageResponse } from "next/og";
import { verifySharedVerdict } from "@/lib/shareVerdict";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "ReviewIntel verdict";

const COLORS: Record<string, string> = { buy: "#047857", wait: "#b45309", skip: "#be123c" };

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const data = verifySharedVerdict((await params).token);
  const label = data?.label || "ReviewIntel";
  const product = data?.product || "Real buyer reviews, plain answers";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg, #ecfdf9 0%, #ffffff 55%, #f8fafc 100%)", borderTop: "16px solid #0b7c78", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 28, color: "#0b7c78", fontWeight: 700, letterSpacing: 2 }}>REVIEWINTEL · SHOULD YOU BUY IT?</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: "#0f172a", lineHeight: 1.15 }}>{product.slice(0, 80)}</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 36 }}>
            <div style={{ display: "flex", background: COLORS[data?.kind || ""] || "#334155", color: "white", fontSize: 64, fontWeight: 800, borderRadius: 999, padding: "16px 52px" }}>{label}</div>
            {data?.score !== null && data?.score !== undefined ? <div style={{ display: "flex", marginLeft: 28, fontSize: 36, color: "#475569" }}>{`Score ${data.score.toFixed(1)} / 10`}</div> : null}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#475569" }}>{data && data.reviewCount > 0 ? `Based on ${data.reviewCount} real buyer reviews${data.sources.length ? ` from ${data.sources.join(", ")}` : ""}` : data ? "Not enough written reviews to judge yet" : "Real buyer reviews, plain answers"}</div>
      </div>
    ),
    size,
  );
}
