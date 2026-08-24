/* Renders whatever ordered approval steps the API returns as a step
 * tracker. Same function serves 1-step (CL) and 2-step (Sabbatical/
 * Maternity) chains — see discussion.md #7. */

function renderApprovalTimeline(container, approvals) {
  container.innerHTML =
    '<ol class="list-group list-group-numbered">' +
    approvals
      .map((step) => {
        const stateClass =
          step.action === "APPROVED" ? "text-success" : step.action === "REJECTED" ? "text-danger" : "text-secondary";
        return (
          '<li class="list-group-item d-flex justify-content-between align-items-center">' +
          "<span>" + esc(step.approverRole) + "</span>" +
          '<span class="' + stateClass + '">' + esc(step.action) + "</span>" +
          "</li>"
        );
      })
      .join("") +
    "</ol>";
}
