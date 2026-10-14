// Reads the product page the shopper already has open. No network. No page turns.
// The same file runs in the extension, the bookmarklet, and the fixture tests.
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ReviewIntelExtract = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MAX_REVIEWS = 30;
  var MAX_TEXT = 2000;

  function bareHost(hostname) {
    return String(hostname || "").replace(/^www\./, "").toLowerCase();
  }

  function storeOf(hostname) {
    var host = bareHost(hostname);
    if (/(^|\.)amazon\.(com|ca|co\.uk|de|fr|es|it|com\.au|in|com\.mx|co\.jp)$/.test(host)) return "amazon";
    if (/(^|\.)walmart\.(com|ca)$/.test(host)) return "walmart";
    if (/(^|\.)bestbuy\.(com|ca)$/.test(host)) return "bestbuy";
    if (/(^|\.)target\.com$/.test(host)) return "target";
    if (/(^|\.)homedepot\.(com|ca)$/.test(host)) return "homedepot";
    return "";
  }

  function productIdFromUrl(value) {
    var url;
    try { url = new URL(String(value || "")); } catch (error) { return ""; }
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    var store = storeOf(url.hostname);
    var path = url.pathname;
    if (store === "amazon") {
      var asin = path.match(/\/(?:dp|gp\/product|gp\/aw\/d|product-reviews)\/([A-Z0-9]{10})(?:[/?#]|$)/i);
      if (asin) return asin[1].toUpperCase();
      var query = url.searchParams.get("asin") || "";
      return /^[A-Z0-9]{10}$/i.test(query) ? query.toUpperCase() : "";
    }
    if (store === "walmart") {
      var item = path.match(/\/reviews\/product\/([A-Z0-9]{6,14})(?:\/|$)/i) || path.match(/\/ip\/(?:.*\/)?([A-Z0-9]{6,14})(?:\/|$)/i);
      return item ? item[1] : "";
    }
    if (store === "bestbuy") {
      var host = bareHost(url.hostname);
      if (host === "bestbuy.com" || host.endsWith(".bestbuy.com")) {
        var us = path.match(/\/site\/(?:reviews\/)?(?:[^/]+)\/(\d{5,9})(?:\.p)?(?:\/|$)/i);
        if (us) return us[1];
        var sku = url.searchParams.get("sku") || "";
        return /^\d{5,9}$/.test(sku) ? sku : "";
      }
      var ca = path.match(/\/(?:product|produit)\/(?:[^/]+)\/(\d{5,9})(?:\/|$)/i) || path.match(/\/api\/reviews\/v2\/products\/(\d{5,9})\/reviews/i);
      return ca ? ca[1] : "";
    }
    if (store === "target") {
      var tcin = path.match(/\/A-(\d{6,9})(?:[/?#]|$)/i);
      if (tcin) return tcin[1];
      var reviewed = url.searchParams.get("reviewedId") || url.searchParams.get("tcin") || "";
      return /^\d{6,9}$/.test(reviewed) ? reviewed : "";
    }
    if (store === "homedepot") {
      var hd = path.match(/\/p\/(?:reviews\/)?(?:[a-z0-9-]+\/)?(\d{6,12})(?:\/|$)/i);
      return hd ? hd[1] : "";
    }
    return "";
  }

  function cleanUrl(value) {
    try {
      var url = new URL(String(value));
      url.hash = "";
      return url.toString();
    } catch (error) {
      return "";
    }
  }

  function clip(value, max) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max ? text.slice(0, max).trim() : text;
  }

  function parseStars(text) {
    var match = String(text || "").match(/([0-5](?:\.\d+)?)\s*out of\s*5/i);
    if (!match) return null;
    var stars = Number(match[1]);
    return stars >= 1 && stars <= 5 ? Math.round(stars * 10) / 10 : null;
  }

  function parseLooseStars(text) {
    var exact = parseStars(text);
    if (exact !== null) return exact;
    var match = String(text || "").trim().match(/^([1-5](?:\.\d+)?)$/);
    if (!match) return null;
    var stars = Number(match[1]);
    return stars >= 1 && stars <= 5 ? Math.round(stars * 10) / 10 : null;
  }

  function parseRatingCount(text) {
    var raw = String(text || "").replace(/,/g, "");
    var words = raw.match(/(\d{1,9})\s*(?:global\s+|customer\s+)?(?:ratings?|reviews?)\b/i);
    if (words) {
      var count = Number(words[1]);
      return count > 0 ? count : null;
    }
    var only = String(text || "").replace(/,/g, "").trim();
    if (/^\d{1,9}$/.test(only)) {
      var plain = Number(only);
      return plain > 0 ? plain : null;
    }
    return null;
  }

  function encodeCapture(capture) {
    var json = JSON.stringify(capture);
    var binary = unescape(encodeURIComponent(json));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeCapture(hash) {
    var body = String(hash || "").replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
    if (!body) return null;
    body += "=".repeat((4 - (body.length % 4)) % 4);
    var binary = atob(body);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    var json = typeof TextDecoder !== "undefined" ? new TextDecoder().decode(bytes) : decodeURIComponent(escape(binary));
    return JSON.parse(json);
  }

  // --- minimal DOM so fixture tests do not need a browser ---

  function decodeEntities(value) {
    return String(value || "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, function (_, n) {
        var code = Number(n);
        return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
      });
  }

  function parseAttrs(raw) {
    var attrs = {};
    var re = /([^\s=\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    var match;
    while ((match = re.exec(raw || ""))) {
      attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
    }
    return attrs;
  }

  function makeEl(tag, attrs) {
    return { type: "el", tag: tag, attrs: attrs, id: attrs.id || "", className: attrs.class || attrs.classname || "", children: [], parent: null };
  }

  function parseHtml(html) {
    var src = String(html || "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
    var root = makeEl("document", {});
    var stack = [root];
    var re = /<\/?([a-zA-Z0-9:-]+)([^>]*)>|([^<]+)/g;
    var match;
    var voidTags = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, source: 1, track: 1, wbr: 1 };
    while ((match = re.exec(src))) {
      if (match[3]) {
        stack[stack.length - 1].children.push({ type: "text", text: decodeEntities(match[3]) });
        continue;
      }
      var tag = match[1].toLowerCase();
      var closing = match[0].charAt(1) === "/";
      var selfClose = /\/\s*>$/.test(match[0]) || voidTags[tag];
      if (closing) {
        while (stack.length > 1 && stack[stack.length - 1].tag !== tag) stack.pop();
        if (stack.length > 1) stack.pop();
        continue;
      }
      var node = makeEl(tag, parseAttrs(match[2]));
      node.parent = stack[stack.length - 1];
      stack[stack.length - 1].children.push(node);
      if (!selfClose) stack.push(node);
    }
    return root;
  }

  function hidden(node) {
    if (!node || node.type !== "el") return false;
    if (Object.prototype.hasOwnProperty.call(node.attrs, "hidden")) return true;
    if (/(?:^|\s)aok-hidden(?:\s|$)/.test(node.className || "")) return true;
    if (node.attrs.style && /display\s*:\s*none/i.test(node.attrs.style)) return true;
    return false;
  }

  function miniText(node) {
    if (!node) return "";
    if (node.type === "text") return node.text || "";
    if (hidden(node) || node.tag === "script" || node.tag === "style") return "";
    var out = "";
    for (var i = 0; i < node.children.length; i += 1) {
      var child = node.children[i];
      if (child.type === "text") out += child.text;
      else if (child.tag === "br") out += " ";
      else out += " " + miniText(child);
    }
    return out.replace(/\s+/g, " ").trim();
  }

  function miniLabels(node, out) {
    if (!node || node.type !== "el") return;
    if (node.attrs["aria-label"]) out.push(node.attrs["aria-label"]);
    if (node.attrs.title) out.push(node.attrs.title);
    for (var i = 0; i < node.children.length; i += 1) miniLabels(node.children[i], out);
  }

  function miniContains(parent, child) {
    var node = child;
    while (node) {
      if (node === parent) return true;
      node = node.parent;
    }
    return false;
  }

  function parseSimple(selector) {
    var simple = { tag: "*", id: "", classes: [], attrs: [] };
    var re = /\[([^\]]+)\]|([#.])([A-Za-z0-9_-]+)|([A-Za-z0-9_-]+)/g;
    var match;
    var any = false;
    while ((match = re.exec(selector))) {
      any = true;
      if (match[1]) {
        var part = match[1].match(/^([^\^*~|$=]+)(?:(\*=|\^=|=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?$/);
        if (!part) continue;
        var name = part[1].trim().toLowerCase();
        if (!part[2]) simple.attrs.push({ name: name, op: "exists", value: "" });
        else simple.attrs.push({ name: name, op: part[2], value: part[3] ?? part[4] ?? part[5] ?? "" });
      } else if (match[2] === "#") simple.id = match[3];
      else if (match[2] === ".") simple.classes.push(match[3]);
      else simple.tag = match[4].toLowerCase();
    }
    return any ? simple : null;
  }

  function matchesSimple(el, simple) {
    if (!el || el.type !== "el" || !simple) return false;
    if (simple.tag !== "*" && el.tag !== simple.tag) return false;
    if (simple.id && el.id !== simple.id) return false;
    var classes = String(el.className || "").split(/\s+/);
    for (var i = 0; i < simple.classes.length; i += 1) {
      if (classes.indexOf(simple.classes[i]) < 0) return false;
    }
    for (var a = 0; a < simple.attrs.length; a += 1) {
      var attr = simple.attrs[a];
      var value = el.attrs[attr.name];
      if (value === undefined) return false;
      if (attr.op === "=" && value !== attr.value) return false;
      if (attr.op === "*=" && String(value).indexOf(attr.value) < 0) return false;
      if (attr.op === "^=" && String(value).indexOf(attr.value) !== 0) return false;
    }
    return true;
  }

  function descendants(node) {
    var out = [];
    var walk = function (current) {
      var children = current.children || [];
      for (var i = 0; i < children.length; i += 1) {
        if (children[i].type !== "el") continue;
        out.push(children[i]);
        walk(children[i]);
      }
    };
    walk(node);
    return out;
  }

  function stepsOf(selector) {
    var steps = [];
    var rest = String(selector || "").trim();
    var comb = "desc";
    while (rest) {
      if (rest.charAt(0) === ">") {
        comb = "child";
        rest = rest.slice(1).trim();
      }
      var match = rest.match(/^((?:[A-Za-z0-9_-]+|[#.][A-Za-z0-9_-]+|\[[^\]]+\])+)/);
      if (!match) break;
      steps.push({ comb: comb, simple: parseSimple(match[1]) });
      rest = rest.slice(match[1].length);
      if (/^\s*>/.test(rest)) {
        comb = "child";
        rest = rest.replace(/^\s*>\s*/, "");
      } else {
        comb = "desc";
        rest = rest.trim();
      }
    }
    return steps;
  }

  function queryCompound(root, selector) {
    var steps = stepsOf(selector);
    if (!steps.length || steps.some(function (step) { return !step.simple; })) return [];
    var current = [root];
    for (var i = 0; i < steps.length; i += 1) {
      var next = [];
      var step = steps[i];
      for (var c = 0; c < current.length; c += 1) {
        var pool = i > 0 && step.comb === "child"
          ? (current[c].children || []).filter(function (child) { return child.type === "el"; })
          : descendants(current[c]);
        for (var p = 0; p < pool.length; p += 1) {
          if (matchesSimple(pool[p], step.simple)) next.push(pool[p]);
        }
      }
      current = next;
      if (!current.length) break;
    }
    return current;
  }

  function queryAllMini(root, selector) {
    var groups = String(selector || "").split(",");
    var found = [];
    var seen = [];
    for (var g = 0; g < groups.length; g += 1) {
      var hits = queryCompound(root, groups[g].trim());
      for (var h = 0; h < hits.length; h += 1) {
        if (seen.indexOf(hits[h]) >= 0) continue;
        seen.push(hits[h]);
        found.push(hits[h]);
      }
    }
    return found;
  }

  function miniHidden(node) {
    var current = node;
    while (current && current.type === "el") {
      if (hidden(current)) return true;
      current = current.parent;
    }
    return false;
  }

  function adaptMini(root) {
    return {
      queryAll: function (scope, selector) { return queryAllMini(scope || root, selector); },
      contains: miniContains,
      hidden: miniHidden,
      text: miniText,
      labels: function (node) {
        var out = [];
        miniLabels(node, out);
        return out.join(" ");
      },
      attr: function (node, name) { return node && node.attrs ? (node.attrs[name.toLowerCase()] || "") : ""; },
    };
  }

  function liveHidden(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      if (node.hasAttribute && node.hasAttribute("hidden")) return true;
      if (/(?:^|\s)aok-hidden(?:\s|$)/.test(node.className || "")) return true;
      if (/display\s*:\s*none/i.test((node.getAttribute && node.getAttribute("style")) || "")) return true;
      node = node.parentElement;
    }
    return false;
  }

  function liveText(el) {
    if (!el || !el.cloneNode) return "";
    var clone = el.cloneNode(true);
    var hiddenNodes = clone.querySelectorAll("script,style,noscript,[hidden],.aok-hidden");
    for (var i = 0; i < hiddenNodes.length; i += 1) hiddenNodes[i].remove();
    return String(clone.textContent || "").replace(/\s+/g, " ").trim();
  }

  function adaptLive(document) {
    return {
      queryAll: function (scope, selector) {
        var root = scope && scope.querySelectorAll ? scope : document;
        return Array.prototype.slice.call(root.querySelectorAll(selector));
      },
      contains: function (parent, child) { return Boolean(parent && child && (parent === child || parent.contains(child))); },
      hidden: liveHidden,
      text: liveText,
      labels: function (el) {
        if (!el) return "";
        var nodes = [el].concat(Array.prototype.slice.call(el.querySelectorAll("[aria-label],[title]")));
        return nodes.map(function (node) {
          return ((node.getAttribute && node.getAttribute("aria-label")) || "") + " " + ((node.getAttribute && node.getAttribute("title")) || "");
        }).join(" ");
      },
      attr: function (el, name) { return el && el.getAttribute ? (el.getAttribute(name) || "") : ""; },
    };
  }

  var CARD_SELECTORS = {
    amazon: "[data-hook='review']",
    walmart: "[data-testid='review'], [data-testid='customer-review']",
    bestbuy: "li.review-item, .ugc-review, .review-item",
    target: "[data-test='review-card'], [data-test='review']",
    homedepot: "[data-testid='review-card'], [data-bv-v='contentItem']",
  };

  var TITLE_SELECTORS = {
    amazon: ["#productTitle", "#title"],
    walmart: ["h1#main-title", "h1[itemprop='name']", "[data-testid='product-title']"],
    bestbuy: [".sku-title h1", "h1.heading-5", ".sku-title"],
    target: ["h1[data-test='product-title']", "[data-test='product-title']"],
    homedepot: ["h1.product-details__title", "h1.product-details__badge-title", "[data-testid='product-title']"],
  };

  var RATING_SELECTORS = {
    amazon: ["#acrPopover", "[data-hook='rating-out-of-text']"],
    walmart: ["[data-testid='rating-number']", "[itemprop='aggregateRating'] [itemprop='ratingValue']"],
    bestbuy: [".ugc-c-review-average", "[itemprop='aggregateRating'] [itemprop='ratingValue']"],
    target: ["[data-test='rating-value']", "[data-test='ratings']"],
    homedepot: [".product-details__rating", "[itemprop='aggregateRating'] [itemprop='ratingValue']"],
  };

  var COUNT_SELECTORS = {
    amazon: ["#acrCustomerReviewText", "[data-hook='total-review-count']"],
    walmart: ["[data-testid='reviews-count']", "[itemprop='aggregateRating'] [itemprop='reviewCount']"],
    bestbuy: [".c-total-reviews", "[itemprop='aggregateRating'] [itemprop='reviewCount']"],
    target: ["[data-test='rating-count']", "[data-test='ratingCount']"],
    homedepot: [".product-details__review-count", "[itemprop='aggregateRating'] [itemprop='reviewCount']"],
  };

  function firstText(doc, selectors, cards) {
    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = doc.queryAll(null, selectors[i]);
      for (var n = 0; n < nodes.length; n += 1) {
        var inside = cards.some(function (card) { return doc.contains(card, nodes[n]) && card !== nodes[n]; });
        if (inside) continue;
        var text = clip(doc.text(nodes[n]), 300);
        var label = clip(doc.labels(nodes[n]), 300);
        var content = clip(doc.attr(nodes[n], "content"), 80);
        if (text || label || content) return { text: text || label || content, node: nodes[n] };
      }
    }
    return { text: "", node: null };
  }

  function readCards(doc, store) {
    var nodes = doc.queryAll(null, CARD_SELECTORS[store]);
    var cards = nodes.filter(function (node) {
      if (doc.hidden(node)) return false;
      return !nodes.some(function (other) { return other !== node && doc.contains(other, node); });
    });
    var reviews = [];
    var bodySelectors = "[data-hook='review-body'], [data-testid='review-text'], [itemprop='reviewBody'], .ugc-review-body, .review-content, [data-test='review-text']";
    var titleSelectors = "[data-hook='review-title'], [data-testid='review-title'], [data-test='review-title'], h3, h4";
    var starSelectors = "[data-hook='review-star-rating'], [data-hook='cmps-review-star-rating'], [itemprop='ratingValue'], [data-test='review-rating'], .c-review-average, .review-rating";
    var dateSelectors = "[data-hook='review-date'], time, [itemprop='datePublished'], [data-test='review-date'], .review-date";
    for (var i = 0; i < cards.length; i += 1) {
      var card = cards[i];
      var bodyNode = doc.queryAll(card, bodySelectors)[0];
      var body = clip(doc.text(bodyNode || card), MAX_TEXT);
      body = body.replace(/\b(?:read more|see more|show more)\b/ig, " ").replace(/\s+/g, " ").trim();
      if (body.length < 8) continue;
      var titleNode = doc.queryAll(card, titleSelectors)[0];
      var title = clip(doc.text(titleNode), 200).replace(/^[0-9.]+\s*out of 5 stars\s*/i, "").trim();
      if (!title || title === body) title = "";
      var starNode = doc.queryAll(card, starSelectors)[0];
      var stars = parseStars(doc.labels(starNode || card) + " " + doc.text(starNode)) || parseLooseStars(doc.attr(starNode, "content") || doc.attr(starNode, "aria-label") || doc.text(starNode));
      var dateNode = doc.queryAll(card, dateSelectors)[0];
      var date = "";
      if (dateNode) date = clip(doc.attr(dateNode, "datetime") || doc.text(dateNode).replace(/^Reviewed in .+? on /i, ""), 80);
      var verified = /verified (?:purchase|purchaser)/i.test(doc.labels(card) + " " + doc.text(card));
      reviews.push({ title: title || null, text: body, stars: stars, date: date || null, verified: verified });
      if (reviews.length >= MAX_REVIEWS) break;
    }
    return reviews;
  }

  function extract(doc, pageUrl) {
    var url = cleanUrl(pageUrl);
    var store = "";
    try { store = storeOf(new URL(url).hostname); } catch (error) { store = ""; }
    var productId = productIdFromUrl(url);
    if (!store || !productId) {
      return { ok: false, error: "Open a product page, then try again." };
    }
    var cards = doc.queryAll(null, CARD_SELECTORS[store]);
    var titleHit = firstText(doc, TITLE_SELECTORS[store], cards);
    var ratingHit = firstText(doc, RATING_SELECTORS[store], cards);
    var countHit = firstText(doc, COUNT_SELECTORS[store], cards);
    var rating = parseStars(doc.labels(ratingHit.node) + " " + ratingHit.text) || parseLooseStars(doc.attr(ratingHit.node, "content") || ratingHit.text);
    var ratingCount = parseRatingCount(doc.attr(countHit.node, "content") || countHit.text);
    return {
      ok: true,
      capture: {
        url: url,
        productId: productId,
        title: clip(titleHit.text, 300),
        rating: rating,
        ratingCount: ratingCount,
        reviews: readCards(doc, store),
      },
    };
  }

  return {
    fromDocument: function (document, pageUrl) { return extract(adaptLive(document), pageUrl); },
    fromHtml: function (html, pageUrl) { return extract(adaptMini(parseHtml(html)), pageUrl); },
    productIdFromUrl: productIdFromUrl,
    encodeCapture: encodeCapture,
    decodeCapture: decodeCapture,
  };
});
