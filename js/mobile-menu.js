(function () {
  function initMobileMenu() {
    if (window.__acceptorIQMobileMenuInit) return;
    window.__acceptorIQMobileMenuInit = true;

    var body = document.body;
    var scrollLockY = 0;

    function openMenu() {
      scrollLockY = window.scrollY || 0;
      body.style.top = "-" + scrollLockY + "px";
      body.classList.add("mobile-menu-open");
    }

    function closeMenu() {
      body.classList.remove("mobile-menu-open");
      body.style.top = "";
      window.scrollTo(0, scrollLockY);
    }

    var btn = document.querySelector(".mobile-menu-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        body.classList.contains("mobile-menu-open") ? closeMenu() : openMenu();
      });
    }

    document.querySelectorAll(".mobile-menu a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.querySelectorAll(".fcol").forEach(function (section) {
      var h4 = section.querySelector("h4");
      if (h4) {
        h4.addEventListener("click", function () {
          section.classList.toggle("is-open");
        });
      }
    });
  }

  document.addEventListener("acceptorIQ:includes-loaded", initMobileMenu);
  document.addEventListener("DOMContentLoaded", function () {
    if (document.querySelector(".mobile-menu-btn")) initMobileMenu();
  });
})();
