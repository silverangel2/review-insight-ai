function normalizeSeed(value: unknown) {
  return String(value || "reviewintel-product")
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hash4(seed: unknown) {
  const clean = normalizeSeed(seed);
  let hash = 2166136261;

  for (let i = 0; i < clean.length; i += 1) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0")
    .slice(0, 4);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function productDisplayCode(seed: unknown) {
  return `PRD-${hash4(seed)}`;
}

export function compareDisplayCode(seed: unknown) {
  return `CMR-${hash4(seed)}`;
}

export function isCompareDisplayItem(value: unknown) {
  const record = asRecord(value);
  const direct = asRecord(record.result || record);
  const analysisJson = asRecord(
    record.analysis_json ||
      record.analysisJson ||
      direct.analysis_json ||
      direct.analysisJson
  );

  const source = Object.keys(analysisJson).length ? analysisJson : direct;

  const hasProductA = source.productA !== undefined && source.productA !== null;
  const hasProductB = source.productB !== undefined && source.productB !== null;

  const typeText = String(source.type || direct.type || record.type || "").toLowerCase();
  const modeText = String(source.mode || direct.mode || record.mode || "").toLowerCase();
  const compareIdText = String(source.compareId || direct.compareId || record.compareId || "");
  const titleText = String(
    source.title ||
      source.fileName ||
      source.productName ||
      direct.title ||
      direct.fileName ||
      direct.productName ||
      record.product_name ||
      record.productName ||
      ""
  ).toLowerCase();

  return Boolean(
    hasProductA &&
      hasProductB &&
      (
        typeText === "compare" ||
        modeText === "buyer_compare" ||
        compareIdText.startsWith("CMR-") ||
        titleText.startsWith("compare:")
      )
  );
}

export function displayCodeForResult(value: unknown, fallbackSeed: unknown = "reviewintel-product") {
  const record = asRecord(value);
  const result = asRecord(record.result);
  const product = asRecord(record.product || result.product);
  const meta = asRecord(record.meta || result.meta);

  const seed =
    record.displayCodeSeed ||
    result.displayCodeSeed ||
    record.scanId ||
    result.scanId ||
    record.id ||
    result.id ||
    record.savedAt ||
    result.savedAt ||
    record.createdAt ||
    result.createdAt ||
    meta.savedAt ||
    meta.createdAt ||
    record.compareId ||
    result.compareId ||
    record.fileName ||
    result.fileName ||
    record.productName ||
    result.productName ||
    product.name ||
    product.title ||
    meta.fileName ||
    meta.productName ||
    record.title ||
    result.title ||
    fallbackSeed;

  return isCompareDisplayItem(value) ? compareDisplayCode(seed) : productDisplayCode(seed);
}
