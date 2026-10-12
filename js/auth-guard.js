/* Runs on every authenticated page. Exposes window.__session for other page
 * scripts and enforces the UI side of RBAC. Every request is still
 * re-authorized server-side regardless of what this hides (discussion.md #6).
 *
 * Access tiers (a higher role includes the ones below it):
 *   ORG_ADMIN > HR > EMPLOYEE      (roles, from the backend)
 *   manager                         (derived: has direct reports; NOT part of
 *                                    the ladder - HR/Admin without reports are
 *                                    not managers)
 * A section/page declares what it needs with data-access="manager|hr|admin"
 * (sidebar section wrappers, and the <html> element for whole pages). */

const ACCESS_RULES = {
  manager: { denied: "You are not a Manager.", ok: (s) => !!s.isManager },
  hr: { denied: "You are not HR.", ok: (s) => s.role === "HR" || s.role === "ORG_ADMIN" },
  admin: { denied: "You are not an Admin.", ok: (s) => s.role === "ORG_ADMIN" },
};

// Roles a session effectively holds, top down.
function effectiveRoles(session) {
  if (session.role === "ORG_ADMIN") return ["ORG_ADMIN", "HR", "EMPLOYEE"];
  if (session.role === "HR") return ["HR", "EMPLOYEE"];
  return [session.role];
}

function hasAccess(session, tier) {
  return !tier || (ACCESS_RULES[tier] && ACCESS_RULES[tier].ok(session));
}

/* Locked sidebar sections stay visible but cannot expand: the section is
 * collapsed, given a lock icon, and clicking its heading shows the alert.
 * Called when the session arrives and again when the sidebar finishes
 * loading (whichever is later) - see js/loader.js. */
function applySidebarLocks(session) {
  document.querySelectorAll("div[data-access]").forEach(function (section) {
    if (hasAccess(session, section.getAttribute("data-access"))) return;
    const btn = section.querySelector("h6 button");
    const list = section.querySelector("ul");
    if (!btn || btn.classList.contains("sidebar-locked")) return;
    btn.classList.add("sidebar-locked");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-disabled", "true");
    if (list) list.classList.remove("show");
    const icon = btn.querySelector("i");
    if (icon) icon.className = "bi bi-lock-fill";
  });
}

// Capture on window so a locked heading is stopped before Bootstrap's
// document-level collapse handler ever sees the click.
window.addEventListener(
  "click",
  function (e) {
    const btn = e.target.closest && e.target.closest("[data-access] h6 button");
    if (!btn || !window.__session) return;
    const tier = btn.closest("[data-access]").getAttribute("data-access");
    if (hasAccess(window.__session, tier)) return;
    e.stopPropagation();
    e.preventDefault();
    showToast(ACCESS_RULES[tier].denied, "error");
  },
  true
);

(function () {
  document.documentElement.setAttribute("data-auth-pending", "true");

  apiClient
    .me()
    .then(function (session) {
      window.__session = session;
      document.documentElement.removeAttribute("data-auth-pending");

      // Gate on user.status (employee-onboarding.md). A PENDING user holds an
      // onboarding-only session — every other endpoint is 403 — so the form is
      // the only page they can use; everyone else has no business on it.
      const onOnboarding = location.pathname.endsWith("onboarding.html");
      if (session.status === "PENDING" && !onOnboarding) {
        window.location.href = "onboarding.html";
        return;
      }
      if (session.status !== "PENDING" && onOnboarding) {
        window.location.href = "dashboard.html";
        return;
      }

      // Page-level guard: too low a tier goes home, carrying the message.
      const pageTier = document.documentElement.getAttribute("data-access");
      if (!hasAccess(session, pageTier)) {
        try {
          sessionStorage.setItem("accessDenied", ACCESS_RULES[pageTier].denied);
        } catch (e) {
          // storage unavailable - they still land on the dashboard, just without the message
        }
        window.location.href = "dashboard.html";
        return;
      }
      try {
        const denied = sessionStorage.getItem("accessDenied");
        if (denied) {
          sessionStorage.removeItem("accessDenied");
          showToast(denied, "error");
        }
      } catch (e) {
        // nothing to show
      }

      applyRoleVisibility(session);
      applySidebarLocks(session);
      document.dispatchEvent(new CustomEvent("session-ready", { detail: session }));
    })
    .catch(function () {
      window.location.href = "login.html";
    });

  function applyRoleVisibility(session) {
    document.querySelectorAll("[data-requires-manager]").forEach(function (el) {
      el.hidden = !session.isManager;
    });
    const roles = effectiveRoles(session);
    document.querySelectorAll("[data-requires-role]").forEach(function (el) {
      const allowed = el.getAttribute("data-requires-role").split(",");
      el.hidden = !allowed.some((r) => roles.indexOf(r) !== -1);
    });
  }
})();
