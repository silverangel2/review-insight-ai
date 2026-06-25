export function shortProductName(value: unknown, fallback = "Product") {
  const raw = String(value || "").replace(/\s+/g, " ").trim();

  if (!raw) return fallback;

  let name = raw
    .replace(/\b(compare|comparison|reviewintel|analysis|result|verdict)\b[:\s-]*/gi, "")
    .replace(/\b(suitable for|compatible with|for use with|works with)\b.*$/i, "")
    .replace(/\b(with|including|includes)\b.*$/i, "")
    .replace(/\b\d+\s*(pack|pcs|pieces|count|set)\b.*$/i, "")
    .replace(/\b\d+(ml|mm|cm|inch|in|oz|lb|kg)\b.*$/i, "")
    .replace(/\s*[-–—|,;/]\s*.*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) name = raw;

  const words = name.split(" ").filter(Boolean);

  if (words.length > 5) {
    name = words.slice(0, 5).join(" ");
  }

  if (name.length > 42) {
    name = `${name.slice(0, 39).trim()}…`;
  }

  return name || fallback;
}

export function shortCompareTitle(value: unknown, fallback = "Product comparison") {
  const raw = String(value || "").replace(/\s+/g, " ").trim();

  if (!raw) return fallback;

  const cleaned = raw.replace(/^compare:\s*/i, "");
  const parts = cleaned.split(/\s+vs\.?\s+|\s+versus\s+/i);

  if (parts.length >= 2) {
    return `${shortProductName(parts[0], "Product A")} vs ${shortProductName(parts.slice(1).join(" vs "), "Product B")}`;
  }

  return shortProductName(cleaned, fallback);
}
