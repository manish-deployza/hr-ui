/* manager_private_notes is manager_id-only per Reasoning/16-module-one-on-one.md
 * (deliberately not HR-visible by default) — gated here by comparing the
 * session's managerId to the viewer's own id, not by role/isManager. */

document.addEventListener("session-ready", function (e) {
  const id = qs("id");
  load(e.detail, id);
});

function load(session, id) {
  apiClient.getOneOnOneSession(id).then((s) => {
    document.getElementById("session-other-party").textContent = s.otherPartyName;
    document.getElementById("session-scheduled-at").textContent = formatDateTime(s.scheduledAt);
    document.getElementById("session-status").innerHTML = renderBadge(s.status, ONE_ON_ONE_STATUS_BADGE_MAP);
    document.getElementById("session-agenda").value = s.sharedAgenda || "";

    const isManager = s.managerId === session.id;
    const notesCard = document.getElementById("notes-card");
    notesCard.hidden = !isManager;
    if (isManager) {
      document.getElementById("session-notes").value = s.managerPrivateNotes || "";
    }

    renderActionItems(s.actionItems || []);

    const canAct = s.status === "SCHEDULED";
    document.getElementById("session-action-buttons").hidden = !canAct;

    document.getElementById("save-agenda-btn").onclick = () => {
      apiClient.updateOneOnOneAgenda(id, document.getElementById("session-agenda").value).catch(showError);
    };
    document.getElementById("save-notes-btn").onclick = () => {
      apiClient.updateOneOnOneNotes(id, document.getElementById("session-notes").value).catch(showError);
    };
    document.getElementById("complete-btn").onclick = () => {
      apiClient.completeOneOnOneSession(id).then(() => window.location.reload()).catch(showError);
    };
    document.getElementById("cancel-btn").onclick = () => {
      apiClient.cancelOneOnOneSession(id).then(() => window.location.reload()).catch(showError);
    };

    document.getElementById("add-action-item-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      const input = document.getElementById("new-action-item");
      const description = normalizeText(input.value);
      if (!description) return;
      apiClient
        .createActionItem(id, { description: description, ownerEmployeeId: session.id, status: "OPEN" })
        .then(() => {
          input.value = "";
          window.location.reload();
        })
        .catch(showError);
    });
  });
}

function renderActionItems(items) {
  const list = document.getElementById("action-items-list");
  list.innerHTML = items.length
    ? items
        .map(
          (item) =>
            '<li class="list-group-item d-flex align-items-center gap-2">' +
            '<input type="checkbox" class="form-check-input mt-0" data-item-id="' + item.id + '"' +
            (item.status === "DONE" ? " checked" : "") +
            ">" +
            '<span class="flex-grow-1' + (item.status === "DONE" ? " text-decoration-line-through text-body-secondary" : "") + '">' + esc(item.description) + "</span>" +
            (item.dueDate ? '<span class="text-body-secondary small">' + formatDate(item.dueDate) + "</span>" : "") +
            "</li>"
        )
        .join("")
    : '<li class="list-group-item text-body-secondary">No action items yet.</li>';

  list.querySelectorAll("input[data-item-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      const itemId = this.getAttribute("data-item-id");
      const sessionId = qs("id");
      apiClient
        .updateActionItem(sessionId, itemId, { status: this.checked ? "DONE" : "OPEN" })
        .then(() => window.location.reload())
        .catch(showError);
    });
  });
}

function showError(err) {
  const errorEl = document.getElementById("session-error");
  errorEl.textContent = err.message || "Could not save the change.";
  errorEl.hidden = false;
}
