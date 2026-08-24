/* Runs on every authenticated page. UX convenience only — every write is
 * still re-authorized server-side regardless of what this hides (see
 * discussion.md #6). Exposes window.__session for other page scripts. */

(function () {
  document.documentElement.setAttribute("data-auth-pending", "true");

  apiClient
    .me()
    .then(function (session) {
      window.__session = session;
      document.documentElement.removeAttribute("data-auth-pending");

      if (session.forcePasswordReset && !location.pathname.endsWith("change-password.html")) {
        window.location.href = "change-password.html";
        return;
      }

      applyRoleVisibility(session);
      document.dispatchEvent(new CustomEvent("session-ready", { detail: session }));
    })
    .catch(function () {
      window.location.href = "login.html";
    });

  function applyRoleVisibility(session) {
    document.querySelectorAll("[data-requires-manager]").forEach(function (el) {
      el.hidden = !session.isManager;
    });
    document.querySelectorAll("[data-requires-role]").forEach(function (el) {
      const allowed = el.getAttribute("data-requires-role").split(",");
      el.hidden = allowed.indexOf(session.role) === -1;
    });
  }
})();
