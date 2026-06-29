(function () {
  var headerHTML = "<header>\n  <div class=\"nav nav-wrap\">\n    <a href=\"/\" class=\"acceptor-logo\" aria-label=\"acceptorIQ home\">\n      <img src=\"/images/acceptorIQ-full.png\" alt=\"acceptorIQ\" class=\"logo-full\">\n    </a>\n    <button class=\"mobile-menu-btn\" aria-label=\"Open menu\"><span></span><span></span></button>\n    <div class=\"nav-right\">\n      <a href=\"/\" class=\"lnk\">Home</a>\n      <a href=\"/pricing\" class=\"lnk\">Pricing</a>\n      <a href=\"/analyser\" class=\"btn btn-cream nav-cta\">Get my review\n        <svg class=\"arr\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14M13 6l6 6-6 6\"/></svg>\n      </a>\n    </div>\n  </div>\n</header>\n<div class=\"mobile-menu\">\n  <a href=\"/\">Home</a>\n  <a href=\"/pricing\">Pricing</a>\n  <a href=\"/faq\">FAQ</a>\n  <a href=\"/contact\">Contact</a>\n  <a href=\"/analyser\" class=\"mm-cta\">Get my review</a>\n</div>\n";
  var footerHTML = "<div class=\"footer-section\">\n  <canvas id=\"footer-mg\"></canvas>\n  <footer class=\"wrap\">\n    <div class=\"fcols\">\n      <div class=\"fbrand\">\n        <a href=\"/\" class=\"acceptor-logo\" aria-label=\"acceptorIQ home\">\n          <img src=\"/images/acceptorIQ-full.png\" alt=\"acceptorIQ\" class=\"logo-full\">\n        </a>\n      </div>\n      <div class=\"fcol\">\n        <h4>Product</h4>\n        <a href=\"/#how-it-works\">How it works</a>\n        <a href=\"/#results\">Results</a>\n        <a href=\"/pricing\">Pricing</a>\n        <a href=\"/faq\">FAQ</a>\n      </div>\n      <div class=\"fcol\">\n        <h4>Company</h4>\n        <a href=\"/\">About</a>\n        <a href=\"/careers\">Careers</a>\n        <a href=\"/contact\">Contact</a>\n      </div>\n      <div class=\"fcol\">\n        <h4>Resources</h4>\n        <a href=\"/faq\">FAQ</a>\n        <a href=\"/privacy-terms#privacy\">Privacy</a>\n        <a href=\"/privacy-terms#terms\">Terms</a>\n      </div>\n      <div class=\"fcol\">\n        <h4>Connect</h4>\n        <a href=\"#\" aria-label=\"acceptorIQ on X\">X (Twitter)</a>\n        <a href=\"#\" aria-label=\"acceptorIQ on LinkedIn\">LinkedIn</a>\n        <a href=\"mailto:hello@acceptorIQ.com.au?subject=Support%20request\">Support</a>\n      </div>\n    </div>\n    <div class=\"fcopy\">\u00a9 2026 acceptorIQ. All rights reserved.</div>\n  </footer>\n</div>\n";

  function injectIncludes() {
    var headerSlot = document.querySelector("[data-include='header']");
    var footerSlot = document.querySelector("[data-include='footer']");
    if (headerSlot) headerSlot.innerHTML = headerHTML;
    if (footerSlot) footerSlot.innerHTML = footerHTML;
    document.dispatchEvent(new CustomEvent("acceptorIQ:includes-loaded"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectIncludes);
  } else {
    injectIncludes();
  }
})();
