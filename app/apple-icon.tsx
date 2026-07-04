import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #14b8a6 100%)",
          color: "white",
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: "-5px",
          fontFamily: "Arial, Helvetica, sans-serif",
          borderRadius: 36,
        }}
      >
        RI
      </div>
    ),
    {
      ...size,
    }
  );
}
