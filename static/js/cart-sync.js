(() => {
  const STORAGE_KEY = "art_studio_cid";

  function safeGetStorage(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function safeSetStorage(key, value) {
    try {
      if (value) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage restrictions
    }
  }

  const params = new URLSearchParams(window.location.search);
  const queryCid = params.get("cid") || "";
  const bodyCid = document.body?.dataset?.cid || "";
  const cid = queryCid || bodyCid || safeGetStorage(STORAGE_KEY);

  if (cid) {
    safeSetStorage(STORAGE_KEY, cid);

    document.querySelectorAll("form").forEach((form) => {
      const action = form.getAttribute("action") || "";
      if (action && action.startsWith("http") && !action.startsWith(window.location.origin)) {
        return;
      }
      let input = form.querySelector('input[name="cid"]');
      if (!input) {
        input = document.createElement("input");
        input.type = "hidden";
        input.name = "cid";
        form.appendChild(input);
      }
      input.value = cid;
    });

    document.querySelectorAll("a[href]").forEach((link) => {
      const rawHref = link.getAttribute("href") || "";
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return;
      }
      try {
        const url = new URL(rawHref, window.location.origin);
        if (url.origin === window.location.origin && !url.searchParams.has("cid")) {
          url.searchParams.set("cid", cid);
          link.setAttribute("href", url.pathname + url.search + url.hash);
        }
      } catch {
        // Ignore malformed URLs
      }
    });

    const countBadges = document.querySelectorAll(".cart-count");
    if (countBadges.length > 0) {
      fetch(`/api/cart?cid=${encodeURIComponent(cid)}`, {
        credentials: "include",
        cache: "no-store",
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.cart_count === "number") {
            countBadges.forEach((badge) => {
              badge.textContent = String(data.cart_count);
            });
          }
        })
        .catch(() => {});
    }
  }
})();
