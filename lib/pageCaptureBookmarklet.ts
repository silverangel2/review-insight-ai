import "server-only";
import { readFileSync } from "fs";
import path from "path";

/** Self-contained bookmark. It reads the open page, then hands the text to ReviewIntel. */
export function buildPageCaptureBookmarklet(origin: string) {
  const extractors = readFileSync(path.join(process.cwd(), "extension/extractors.js"), "utf8");
  const safeOrigin = origin.replace(/\/$/, "");
  const body = [
    extractors,
    "var result=ReviewIntelExtract.fromDocument(document,location.href);",
    "if(!result.ok){window.alert(result.error||'Open a product page, then try again.');return;}",
    "var hash=ReviewIntelExtract.encodeCapture(result.capture);",
    `window.open(${JSON.stringify(safeOrigin)}+"/tools/page-capture#"+hash,"_blank","noopener");`,
  ].join("\n");
  return `javascript:${encodeURIComponent(`(function(){\n${body}\n})();`)}`;
}
