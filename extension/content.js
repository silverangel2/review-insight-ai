// ReviewIntel "Check reviews" button. No scraping: it reads only the page URL to find the
// product id, then opens ReviewIntel's own /analyze page in a new tab. No storage, no network.
(function () {
  "use strict";
  var REVIEWINTEL_ORIGIN = "https://getreviewintel.com";
  var match = location.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  if (!match || document.getElementById("reviewintel-check-reviews")) return;
  var productUrl = location.origin + "/dp/" + match[1].toUpperCase();
  var link = document.createElement("a");
  link.id = "reviewintel-check-reviews";
  link.href = REVIEWINTEL_ORIGIN + "/analyze?url=" + encodeURIComponent(productUrl);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Check reviews";
  link.setAttribute("aria-label", "Check reviews for this product on ReviewIntel (opens a new tab)");
  var close = document.createElement("button");
  close.type = "button";
  close.id = "reviewintel-check-reviews-close";
  close.textContent = "\u00d7";
  close.setAttribute("aria-label", "Hide the ReviewIntel button on this page");
  var wrap = document.createElement("div");
  wrap.id = "reviewintel-check-reviews-wrap";
  wrap.appendChild(link);
  wrap.appendChild(close);
  close.addEventListener("click", function () { wrap.remove(); });
  document.body.appendChild(wrap);
})();
