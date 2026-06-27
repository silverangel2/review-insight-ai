export function shortProductName(value: unknown, fallback = "Product") {
  const raw = String(value || "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return fallback;

  let name = raw
    .replace(/^screenshot\s+\d{4}.*$/i, "Uploaded screenshot")
    .replace(/^screen\s*shot\s+\d{4}.*$/i, "Uploaded screenshot")
    .replace(/\b(compare|comparison|reviewintel|analysis|result|verdict)\b[:\s-]*/gi, "")
    .replace(/\b(suitable for|compatible with|for use with|works with)\b.*$/i, "")
    .replace(/\b(with|including|includes)\b.*$/i, "")
    .replace(/\b\d+\s*(pack|pcs|pieces|count|set)\b.*$/i, "")
    .replace(/\b(no wall charger included|wall charger included)\b.*$/i, "")
    .replace(/\b\d+(ml|mm|cm|inch|in|oz|lb|kg)\b.*$/i, "")
    .replace(/\s*[-–—|,;/]\s*.*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) name = raw;

  const words = name.split(" ").filter(Boolean);

  if (words.length > 4) {
    name = words.slice(0, 4).join(" ");
  }

  if (name.length > 34) {
    name = `${name.slice(0, 31).trim()}…`;
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
