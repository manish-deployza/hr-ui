/* Server re-authorizes every action regardless (discussion.md #5/#6) — the
 * button visibility here is UX only, matching the current pending step's
 * approverRole against the viewer's session role/isManager. */

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
    const canAct = currentStep && ((currentStep.approverRole === "MANAGER" && session.isManager) || (currentStep.approverRole === "HR_ADMIN" && session.role === "HR_ADMIN"));
    document.getElementById("approve-btn").hidden = !canAct;
    document.getElementById("reject-btn").hidden = !canAct;

    const canCancel = ["APPLIED", "PENDING_MANAGER", "PENDING_HR_ADMIN"].indexOf(request.status) !== -1;
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
