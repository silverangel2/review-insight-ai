import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const root = new URL("..", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(root + "extension/manifest.json", "utf8"));
const src = readFileSync(root + "extension/content.js", "utf8");
const extractors = readFileSync(root + "extension/extractors.js", "utf8");

const ALLOWED_HOST = /^https:\/\/\*\.(amazon\.(com|ca|co\.uk|de|fr|es|it|com\.au|in|com\.mx|co\.jp)|walmart\.(com|ca)|bestbuy\.(com|ca)|target\.com|homedepot\.(com|ca))\/\*$/;

test("extension: MV3, activeTab only, content scripts only on supported storefronts", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab"]);
  assert.equal(manifest.background, undefined);
  assert.ok(manifest.host_permissions.length > 0);
  for (const host of [...manifest.host_permissions, ...manifest.content_scripts[0].matches]) {
    assert.match(host, ALLOWED_HOST);
  }
  assert.deepEqual(manifest.content_scripts[0].js, ["config.js", "extractors.js", "content.js"]);
});

test("extension: reads the visible page only after Analyze is clicked, with no crawling", () => {
  assert.doesNotMatch(src + extractors, /fetch\s*\(|XMLHttpRequest|chrome\.storage|pageNumber\s*=|setInterval/);
  assert.match(src, /Analyze with ReviewIntel/);
  assert.match(src, /fromDocument/);

  const opened = [];
  const listeners = [];
  const appended = [];
  const el = (tag) => ({
    tag,
    setAttribute() {},
    appendChild(child) { (this.children ||= []).push(child); },
    addEventListener(type, fn) { listeners.push({ type, fn }); },
    remove() {},
  });
  const document = {
    getElementById: () => null,
    createElement: el,
    documentElement: { appendChild: (node) => appended.push(node) },
  };
  const capture = { url: "https://www.amazon.ca/dp/B0TEST0001", productId: "B0TEST0001", reviews: [] };
  vm.runInNewContext(src, {
    document,
    location: { href: "https://www.amazon.ca/Some-Item/dp/b0test0001/ref=x", pathname: "/Some-Item/dp/b0test0001/ref=x" },
    window: { open: (url) => opened.push(url), alert() {} },
    chrome: { runtime: { onMessage: { addListener() {} } } },
    ReviewIntelExtract: {
      productIdFromUrl: () => "B0TEST0001",
      fromDocument: () => ({ ok: true, capture }),
      encodeCapture: () => "encoded-capture",
    },
  });

  const wrap = appended[0];
  const button = wrap.children[0];
  assert.equal(button.textContent, "Analyze with ReviewIntel");
  assert.equal(opened.length, 0);
  const click = listeners.filter((listener) => listener.type === "click");
  assert.equal(click.length, 2);
  click[1].fn();
  assert.equal(opened.length, 1);
  assert.equal(opened[0], "https://getreviewintel.com/tools/page-capture#encoded-capture");
});
