document.getElementById("analyze").addEventListener("click", function () {
  var status = document.getElementById("status");
  status.textContent = "";
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    if (!tab || !tab.id) {
      status.textContent = "Open a product page, then try again.";
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: "reviewintel-read" }, function (result) {
      if (chrome.runtime.lastError || !result || !result.ok) {
        status.textContent = (result && result.error) || "Open a product page, then try again.";
        return;
      }
      var origin = String(self.REVIEWINTEL_ORIGIN || "https://getreviewintel.com").replace(/\/$/, "");
      var hash = btoa(unescape(encodeURIComponent(JSON.stringify(result.capture)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      chrome.tabs.create({ url: origin + "/tools/page-capture#" + hash });
    });
  });
});
