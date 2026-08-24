/* Injects header/sidebar into pages that have the placeholder divs. No API
 * calls here (discussion.md #7) — session-driven wiring (name, sign out)
 * happens on the "session-ready" event fired by auth-guard.js. */

(function () {
  function include(id, path) {
    const target = document.getElementById(id);
    if (!target) return Promise.resolve();
    return fetch(path)
      .then((res) => res.text())
      .then((html) => {
        target.innerHTML = html;
      });
  }

  Promise.all([
    include("header-placeholder", "components/header.html"),
    include("sidebar-placeholder", "components/sidebar.html"),
  ]).then(() => {
    // auth-guard.js's "session-ready" can fire before these partials finish
    // loading — if it already did, window.__session is set, so paint the
    // name immediately instead of waiting on an event that already passed.
    if (window.__session) setUserName(window.__session);
    document.addEventListener("session-ready", (e) => setUserName(e.detail));

    document.addEventListener("click", function (e) {
      if (e.target && e.target.id === "header-signout") {
        apiClient.logout().finally(() => (window.location.href = "login.html"));
      }
    });

    highlightActiveNavLink();
    renderBreadcrumbs();
  });

  function setUserName(session) {
    const nameEl = document.getElementById("header-user-name");
    if (nameEl) nameEl.textContent = session.name;
  }

  // Detail pages (e.g. appraisal-view.html, leave-view.html) have no sidebar
  // entry of their own — they're reached by "Open"-ing a row from one of
  // several possible list pages (My Appraisals vs Team Appraisals, etc.), so
  // which sidebar link they belong to can't be hardcoded. document.referrer
  // recovers it: whichever sidebar link matches where the click came from.
  function findRelevantNavLink() {
    // link.pathname (not getAttribute) is the browser-resolved absolute path,
    // so this matches regardless of what folder the page happens to be
    // served under, and regardless of the href being page-relative here.
    // Several sidebar links can share a pathname (a detail page reached via
    // #hash from more than one list link) — an exact pathname+hash match
    // wins over a bare pathname match.
    const current = window.location.pathname;
    const currentHash = window.location.hash;
    const links = document.querySelectorAll(".sidebar .nav-link");

    let fallback = null;
    for (const link of links) {
      if (link.pathname !== current) continue;
      if (link.hash === currentHash) return { link: link, isCurrentPage: true };
      if (!link.hash && !fallback) fallback = link;
    }
    if (fallback) return { link: fallback, isCurrentPage: true };

    if (document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer);
        for (const link of links) {
          if (link.pathname === referrerUrl.pathname && !link.hash) return { link: link, isCurrentPage: false };
        }
      } catch (e) {
        // malformed/unavailable referrer — fall through to no match
      }
    }
    return null;
  }

  // Walk up through every ancestor .collapse (e.g. the "Manager"/"HR Admin"
  // section headings), expanding each one — otherwise a link straight into a
  // page whose nav item lives inside a collapsed section highlights an item
  // that's still hidden.
  function expandAncestorCollapses(link) {
    let el = link.closest(".collapse");
    while (el) {
      if (!el.classList.contains("show") && window.bootstrap) {
        bootstrap.Collapse.getOrCreateInstance(el, { toggle: false }).show();
      }
      el = el.parentElement ? el.parentElement.closest(".collapse") : null;
    }
  }

  function highlightActiveNavLink() {
    const match = findRelevantNavLink();
    if (!match) return;
    match.link.classList.add("active");
    if (match.isCurrentPage) expandAncestorCollapses(match.link);
  }

  // Walks up through however many <ul>s a link is nested in (a submenu link
  // is two deep: its own <ul>, then the section <ul> whose previous sibling
  // is the section's <h6>) to find the enclosing section heading, if any.
  function findSectionHeading(link) {
    let ul = link.closest("ul");
    while (ul) {
      if (ul.previousElementSibling && ul.previousElementSibling.tagName === "H6") {
        return ul.previousElementSibling.textContent.trim();
      }
      const li = ul.closest("li");
      ul = li && li.parentElement ? li.parentElement.closest("ul") : null;
    }
    return null;
  }

  // Derived from the sidebar (matched link + its section heading, if any)
  // rather than hardcoded per page, so pages don't need to declare their
  // own breadcrumb trail.
  function renderBreadcrumbs() {
    const list = document.getElementById("header-breadcrumb");
    if (!list) return;

    if (window.location.pathname.endsWith("/dashboard.html")) {
      list.innerHTML = '<li class="breadcrumb-item active" aria-current="page">Dashboard</li>';
      return;
    }

    const crumbs = ['<li class="breadcrumb-item"><a href="dashboard.html">Dashboard</a></li>'];
    const match = findRelevantNavLink();

    if (match) {
      const heading = findSectionHeading(match.link);
      if (heading) crumbs.push('<li class="breadcrumb-item">' + esc(heading) + "</li>");

      const linkLabel = esc(match.link.textContent.trim());
      if (match.isCurrentPage) {
        crumbs.push('<li class="breadcrumb-item active" aria-current="page">' + linkLabel + "</li>");
      } else {
        // Came from this sidebar page but this isn't it — link back, then
        // add the detail page's own title as the final active crumb.
        crumbs.push('<li class="breadcrumb-item"><a href="' + match.link.getAttribute("href") + '">' + linkLabel + "</a></li>");
        const label = document.title.split(" — ")[0].trim();
        if (label) crumbs.push('<li class="breadcrumb-item active" aria-current="page">' + esc(label) + "</li>");
      }
    } else {
      const label = document.title.split(" — ")[0].trim();
      if (label) crumbs.push('<li class="breadcrumb-item active" aria-current="page">' + esc(label) + "</li>");
    }

    list.innerHTML = crumbs.join("");
  }
})();
