// Shows one button. Reviews are read only after the shopper clicks it.
(function () {
  "use strict";
  if (!globalThis.ReviewIntelExtract) return;

  function openCapture(capture) {
    var origin = String(globalThis.REVIEWINTEL_ORIGIN || "https://getreviewintel.com").replace(/\/$/, "");
    var hash = ReviewIntelExtract.encodeCapture(capture);
    window.open(origin + "/tools/page-capture#" + hash, "_blank", "noopener");
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || message.type !== "reviewintel-read") return;
    sendResponse(ReviewIntelExtract.fromDocument(document, location.href));
  });

  if (document.getElementById("reviewintel-analyze") || !ReviewIntelExtract.productIdFromUrl(location.href)) return;

  var button = document.createElement("button");
  button.type = "button";
  button.id = "reviewintel-analyze";
  button.textContent = "Analyze with ReviewIntel";
  button.setAttribute("aria-label", "Analyze with ReviewIntel. Reads the reviews already visible on this page.");

  var close = document.createElement("button");
  close.type = "button";
  close.id = "reviewintel-analyze-close";
  close.textContent = "\u00d7";
  close.setAttribute("aria-label", "Hide the ReviewIntel button on this page");

  var wrap = document.createElement("div");
  wrap.id = "reviewintel-analyze-wrap";
  wrap.appendChild(button);
  wrap.appendChild(close);
  close.addEventListener("click", function () { wrap.remove(); });
  button.addEventListener("click", function () {
    var result = ReviewIntelExtract.fromDocument(document, location.href);
    if (!result.ok) {
      window.alert(result.error || "Open a product page, then try again.");
      return;
    }
    openCapture(result.capture);
  });
  document.documentElement.appendChild(wrap);
})();
