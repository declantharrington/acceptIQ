(function () {
  async function loadInclude(selector, url) {
    var el = document.querySelector(selector);
    if (!el) return;
    var res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load " + url);
    el.innerHTML = await res.text();
  }

  Promise.all([
    loadInclude("[data-include='header']", "/includes/header.html"),
    loadInclude("[data-include='footer']", "/includes/footer.html")
  ])
  .then(function () {
    document.dispatchEvent(new CustomEvent("acceptorIQ:includes-loaded"));
  })
  .catch(function (err) {
    console.error(err);
  });
})();
