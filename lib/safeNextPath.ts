export function safeInternalPath(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) return null;
  if (trimmed.includes("://") || trimmed.includes("\\") || trimmed.includes("\n") || trimmed.includes("\r")) return null;
  return trimmed;
}
