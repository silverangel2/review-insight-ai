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
    // Parenthetical variants ("(5th Gen, 2022 release)") are model metadata,
    // not part of the readable product name — strip them before shortening so
    // headlines never end mid-parenthesis like "Echo Dot (5th Gen,".
    .replace(/\s*\([^()]{0,60}\)/g, "")
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
    const kept = words.slice(0, 4);
    // Never leave a dangling preposition/conjunction: "CeraVe Moisturizing
    // Cream for" reads as a cut-off, not a headline. Drop trailing fillers.
    while (kept.length > 2 && /^(for|with|and|the|of|in|on|a|an|to)$/i.test(kept[kept.length - 1])) {
      kept.pop();
    }
    name = `${kept.join(" ")}…`;
  }

  if (name.length > 40) {
    const cut = name.slice(0, 37).trim();
    const boundary = cut.lastIndexOf(" ");
    name = `${(boundary > 20 ? cut.slice(0, boundary) : cut).trim()}…`;
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
