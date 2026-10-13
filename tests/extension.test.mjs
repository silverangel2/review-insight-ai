import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
const root = new URL("..", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(root + "extension/manifest.json", "utf8"));
const src = readFileSync(root + "extension/content.js", "utf8");

test("extension: MV3, no permissions, content script only on Amazon storefronts", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.permissions, undefined); assert.equal(manifest.host_permissions, undefined); assert.equal(manifest.background, undefined);
  for (const m of manifest.content_scripts[0].matches) assert.match(m, /^https:\/\/www\.amazon\.[a-z.]+\/\*$/);
});

test("extension: no scraping or network; builds a clean /analyze link from the URL only", () => {
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|chrome\.storage|innerText|querySelectorAll|textContent\s*\)/);
  const appended = [];
  const el = () => ({ setAttribute() {}, appendChild(c) { (this.children ||= []).push(c); }, addEventListener() {}, remove() {} });
  const document = { getElementById: () => null, createElement: el, body: { appendChild: n => appended.push(n) } };
  vm.runInNewContext(src, { document, location: { pathname: "/Some-Item/dp/b0test0001/ref=x", origin: "https://www.amazon.ca" }, encodeURIComponent });
  const link = appended[0].children[0];
  assert.equal(link.href, "https://getreviewintel.com/analyze?url=" + encodeURIComponent("https://www.amazon.ca/dp/B0TEST0001"));
  assert.equal(link.textContent, "Check reviews");
});
