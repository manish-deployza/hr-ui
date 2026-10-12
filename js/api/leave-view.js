/* Server re-authorizes every action regardless (discussion.md #5/#6) — the
 * button visibility here is UX only, matching the current pending step's
 * approverRole against the viewer's session role/isManager. */

// ?embed=1 means this page is loaded inside #leave-detail-modal's iframe
// (components/header.html, opened from a LEAVE_REQUEST notification —
// js/notification-bell.js) rather than navigated to directly, so its own
// header/sidebar/footer chrome would just duplicate the modal's own frame.
// Runs immediately (not gated on session-ready) so the chrome never flashes
// visible before hiding. See body.embed-mode in css/styles.css.
if (qs("embed") === "1") document.body.classList.add("embed-mode");

document.addEventListener("session-ready", function (session) {
  const id = qs("id");
  load(session.detail || session, id);
});

function load(session, id) {
  apiClient.getLeaveRequest(id).then((request) => {
    document.getElementById("detail-type").textContent = request.leaveTypeName;
    document.getElementById("detail-dates").textContent = formatDate(request.startDate) + " – " + formatDate(request.endDate);
    document.getElementById("detail-status").innerHTML = renderStatusBadge(request.status);
    document.getElementById("detail-reason").textContent = request.reason || "—";

    renderApprovalTimeline(document.getElementById("approval-timeline"), request.approvals || []);

    const currentStep = (request.approvals || []).find((s) => s.action === "PENDING");
    const canAct = currentStep && ((currentStep.approverRole === "MANAGER" && session.isManager) || (currentStep.approverRole === "HR" && session.role === "HR"));
    document.getElementById("approve-btn").hidden = !canAct;
    document.getElementById("reject-btn").hidden = !canAct;

    const canCancel = ["APPLIED", "PENDING_MANAGER", "PENDING_HR"].indexOf(request.status) !== -1;
    document.getElementById("cancel-btn").hidden = !canCancel;

    document.getElementById("approve-btn").onclick = () => act(id, "APPROVED");
    document.getElementById("reject-btn").onclick = () => act(id, "REJECTED");
    document.getElementById("cancel-btn").onclick = () => {
      apiClient.cancelLeaveRequest(id).then(() => window.location.reload());
    };
  });
}

function act(id, action) {
  const errorEl = document.getElementById("action-error");
  errorEl.hidden = true;
  apiClient
    .actOnLeaveRequest(id, action)
    .then(() => window.location.reload())
    .catch((err) => {
      errorEl.textContent = err.message || "Could not record decision.";
      errorEl.hidden = false;
    });
}
