/* Polls all notifications every 60s and on page load, feeding both the bell
 * (red dot only, no count — see discussion.md #7) and its dropdown list of
 * the most recent notifications. Not real-time. */

(function () {
  const MAX_SHOWN = 8;
  let unreadOnly = false;
  let lastItems = [];

  // Only LEAVE_REQUEST is a confirmed relatedEntityType (API-REQUIREMENTS.md);
  // anything else renders as plain, unlinked text until a real one shows up.
  const ENTITY_LINK = {
    LEAVE_REQUEST: (id) => `leave-view.html?id=${encodeURIComponent(id)}`,
  };

  function itemHtml(n) {
    const titleHtml =
      '<div class="notification-item-title">' + esc(n.title) + "</div>";
    const bodyHtml =
      titleHtml +
      '<div class="notification-item-message">' + esc(n.message) + "</div>" +
      '<div class="notification-item-time">' + esc(formatDateTime(n.createdAt)) + "</div>";

    const cls = "notification-item" + (n.isRead ? "" : " notification-item--unread");
    const link = ENTITY_LINK[n.relatedEntityType];
    return link
      ? `<a class="${cls}" data-notif-id="${n.id}" href="${esc(link(n.relatedEntityId))}">${bodyHtml}</a>`
      : `<div class="${cls}" data-notif-id="${n.id}">${bodyHtml}</div>`;
  }

  // Opens a LEAVE_REQUEST notification's detail in the shared modal
  // (components/header.html's #leave-detail-modal) instead of navigating to
  // leave-view.html — no separate page load for what's just a popup. The
  // href stays on the <a> so ctrl/cmd/middle-click still opens it in a new
  // tab normally; only a plain click is intercepted.
  function openLeaveModal(id) {
    const modalEl = document.getElementById("leave-detail-modal");
    const frame = document.getElementById("leave-detail-frame");
    if (!modalEl || !frame) return;
    frame.src = "leave-view.html?id=" + encodeURIComponent(id) + "&embed=1";
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  // Marks the clicked notification read without blocking navigation to its
  // linked page — best-effort, same as markAllRead below.
  let listWired = false;
  function wireList(list) {
    if (listWired) return;
    listWired = true;
    list.addEventListener("click", function (ev) {
      const item = ev.target.closest("[data-notif-id]");
      if (!item) return;
      const id = Number(item.getAttribute("data-notif-id"));
      const n = lastItems.find((x) => x.id === id);
      if (n && !n.isRead) apiClient.markNotificationRead(id).catch(() => {});

      if (n && n.relatedEntityType === "LEAVE_REQUEST" && !ev.ctrlKey && !ev.metaKey && ev.button === 0) {
        ev.preventDefault();
        openLeaveModal(n.relatedEntityId);
      }
    });
  }

  function refresh() {
    const dot = document.getElementById("notification-dot");
    const list = document.getElementById("notification-list");
    if (!dot || !list) return;
    wireList(list);
    apiClient
      .notifications(unreadOnly)
      .then((items) => {
        lastItems = items;
        dot.hidden = !items.some((n) => !n.isRead);

        const sorted = items
          .slice()
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, MAX_SHOWN);
        list.innerHTML = sorted.length
          ? sorted.map(itemHtml).join("")
          : '<div class="notification-empty">No notifications.</div>';
      })
      .catch(() => {
        // Best-effort poll — leave the last-known state showing rather than
        // surface an error for a non-critical background refresh.
      });
  }

  function markAllRead() {
    const unread = lastItems.filter((n) => !n.isRead);
    if (!unread.length) return;
    Promise.all(unread.map((n) => apiClient.markNotificationRead(n.id).catch(() => {})))
      .then(refresh);
  }

  window.toggleUnreadNotifications = function () {
    unreadOnly = !unreadOnly;
    const btn = document.getElementById("notification-unread-toggle");
    if (btn) {
      btn.textContent = unreadOnly ? "Show all" : "Unread only";
      btn.setAttribute("aria-pressed", String(unreadOnly));
    }
    refresh();
  };

  document.addEventListener("session-ready", refresh);
  setInterval(refresh, 60000);

  const bellBtn = document.getElementById("notification-bell-btn");
  if (bellBtn) bellBtn.addEventListener("shown.bs.dropdown", markAllRead);
})();
