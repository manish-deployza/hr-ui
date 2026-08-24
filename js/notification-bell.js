/* Polls for unread notifications every 60s and on page load. Not
 * real-time — see discussion.md #7. */

(function () {
  function refresh() {
    const el = document.getElementById("notification-bell");
    if (!el) return;
    apiClient
      .notificationsUnread()
      .then((items) => {
        el.textContent = items.length ? "🔔 " + items.length : "🔔";
      })
      .catch(() => {
        // Best-effort poll — leave the last-known count showing rather than
        // surface an error for a non-critical background refresh.
      });
  }

  document.addEventListener("session-ready", refresh);
  setInterval(refresh, 60000);
})();
