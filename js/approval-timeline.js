/* Renders whatever ordered approval steps the API returns as a step
 * tracker. Same function serves 1-step (CL) and 2-step (Sabbatical/
 * Maternity) chains — see discussion.md #7.
 *
 * employeesById (optional): id -> employee map used to resolve
 * approverEmployeeId to the approving manager/HR's email, when the caller
 * has that roster loaded (e.g. hr-requests.js). Callers without it (most
 * pages) just get the role/action as before. */
function renderApprovalTimeline(container, approvals, employeesById) {
  container.innerHTML =
    '<ol class="list-group list-group-numbered">' +
    approvals
      .map((step) => {
        const approver = employeesById && step.approverEmployeeId != null ? employeesById[step.approverEmployeeId] : null;
        return (
          '<li class="list-group-item d-flex justify-content-between align-items-center gap-3 flex-wrap">' +
          '<div class="py-1">' +
          '<div class="fw-semibold">' + esc(step.approverRole) + "</div>" +
          (approver && approver.email ? '<div class="text-body-secondary small">' + esc(approver.email) + "</div>" : "") +
          "</div>" +
          renderBadge(step.action, STATUS_BADGE_MAP) +
          "</li>"
        );
      })
      .join("") +
    "</ol>";
}
