// Generic product identifiers (GTIN/UPC/EAN, manufacturer model / part number)
// read from a fetched page's own structured data and specification tables.
// Used to (a) discover the same product at other public retailers and
// (b) verify a fetched retailer page is the exact product. Never invents ids.

export type ListingIdentifiers = { gtins: string[]; models: string[] };

const GTIN_LABEL = /(?:UPC|EAN|GTIN|Global Trade Identification Number|UPC Code|Barcode)/i;
const MODEL_LABEL = /(?:Item model number|Model Number|Model No\.?|Model #|Manufacturer Part Number|Part Number|MPN|Mfr\.? Part #|Manufacturer Model)/i;

function strip(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&lrm;|&rlm;|&#x200[ef];|&nbsp;|[\u200e\u200f]/gi, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

/** Returns the GTIN-14 form when the digits carry a valid GS1 check digit. */
export function normalizeGtin(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  const padded = digits.padStart(14, "0");
  if (/^0+$/.test(padded)) return null;
  const sum = padded.slice(0, 13).split("").reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(padded[13]) ? padded : null;
}

/** Model identifiers must mix letters and digits (or be long digit strings) to be discriminative. */
export function normalizeModelId(value: unknown): string | null {
  const text = strip(String(value ?? "")).toUpperCase();
  if (!text || text.length > 40 || /\s{1,}\S+\s+\S+\s+\S+/.test(text)) return null;
  const compact = text.replace(/[\s_./-]+/g, "");
  if (compact.length < 4 || compact.length > 24) return null;
  if (!/[A-Z]/.test(compact) || !/\d/.test(compact)) return null;
  return compact;
}

export function extractListingIdentifiers(html: string): ListingIdentifiers {
  const gtins = new Set<string>();
  const models = new Set<string>();
  const source = String(html || "");
  // JSON-LD / inline JSON structured fields.
  for (const match of source.matchAll(/"(gtin(?:8|12|13|14)?|upc|ean)"\s*:\s*"?([0-9 -]{8,20})"?/gi)) {
    const gtin = normalizeGtin(match[2]);
    if (gtin) gtins.add(gtin);
  }
  for (const match of source.matchAll(/"(mpn|model|modelNumber)"\s*:\s*"([^"]{2,40})"/gi)) {
    const model = normalizeModelId(match[2]);
    if (model) models.add(model);
  }
  // schema.org microdata.
  for (const match of source.matchAll(/itemprop=["'](gtin(?:8|12|13|14)?|mpn|model)["'][^>]*?(?:content=["']([^"']+)["'][^>]*>|>([^<]{2,40})<)/gi)) {
    const value = match[2] || match[3] || "";
    if (/^gtin/i.test(match[1])) { const gtin = normalizeGtin(value); if (gtin) gtins.add(gtin); }
    else { const model = normalizeModelId(value); if (model) models.add(model); }
  }
  // Label / value specification rows (th/td, dt/dd, span pairs).
  for (const match of source.matchAll(/<(?:th|dt|span|td|div)[^>]*>\s*([^<]{2,60}?)\s*<\/(?:th|dt|span|td|div)>\s*(?:<[^>]+>\s*){0,3}<(?:td|dd|span|div)[^>]*>([\s\S]{1,120}?)<\/(?:td|dd|span|div)>/gi)) {
    const label = strip(match[1]).replace(/[:\u200e\u200f]/g, "").trim();
    const value = strip(match[2]);
    if (label.length > 45) continue;
    if (GTIN_LABEL.test(label)) { for (const part of value.split(/[,;/ ]+/)) { const gtin = normalizeGtin(part); if (gtin) gtins.add(gtin); } }
    else if (MODEL_LABEL.test(label)) { const model = normalizeModelId(value); if (model) models.add(model); }
  }
  return { gtins: [...gtins].slice(0, 8), models: [...models].slice(0, 8) };
}

/** Same product when a valid GTIN or a discriminative model id is shared. */
export function identifiersMatch(verified: ListingIdentifiers, page: ListingIdentifiers): boolean {
  if (verified.gtins.some(gtin => page.gtins.includes(gtin))) return true;
  return verified.models.some(model => model.length >= 5 && page.models.includes(model));
}

/** A different GTIN with no shared model is a different product/variant. */
export function identifiersConflict(verified: ListingIdentifiers, page: ListingIdentifiers): boolean {
  return verified.gtins.length > 0 && page.gtins.length > 0 && !identifiersMatch(verified, page);
}

/** Short identifier-led discovery queries; long synthetic phrases rarely match retailer pages. */
export function identifierDiscoveryQueries(brand: string | null | undefined, ids: ListingIdentifiers, rawModels: string[] = []): string[] {
  const b = String(brand || "").trim();
  const modelLabels = [...rawModels, ...ids.models].map(value => String(value).trim()).filter(value => normalizeModelId(value)).slice(0, 2);
  const queries: string[] = [];
  for (const model of modelLabels) {
    queries.push(`${b} "${model}" reviews`.trim());
    queries.push(`${b} "${model}" (site:walmart.ca OR site:walmart.com OR site:bestbuy.ca OR site:bestbuy.com)`);
    queries.push(`${b} "${model}" (site:homedepot.ca OR site:homedepot.com OR site:canadiantire.ca OR site:costco.ca OR site:target.com)`);
  }
  const upc = ids.gtins[0]?.replace(/^0+(?=\d{12}$)/, "");
  if (upc) queries.push(`${b} "${upc}"`);
  // Every query carries the brand so results stay anchored to the product identity.
  return [...new Set(queries.map(query => query.trim()))];
}
