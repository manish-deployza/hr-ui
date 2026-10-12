/* One card block per direct report, each showing their leave balances via
 * the same renderLeaveBalanceCards helper the dashboard uses (discussion.md
 * #7 — same function serves both contexts). Read-only, no actions here. */

document.addEventListener("session-ready", function () {
  apiClient.managerTeam().then((team) => {
    const container = document.getElementById("team-list");
    container.innerHTML = team
      .map((member) => '<div class="team-member"><h3 class="h6 mt-3">' + esc(member.name) + '</h3><div class="d-flex flex-wrap mb-3" id="team-balances-' + member.id + '"></div></div>')
      .join("");

    team.forEach((member) => {
      renderLeaveBalanceCards(document.getElementById("team-balances-" + member.id), member.balances);
    });
  });

  apiClient.managerTeamRequests().then(renderOnLeaveToday);
});

// Cross-references team requests against "today" rather than a dedicated
// endpoint — reuses the same overlap check the HR requests date filter
// already does (js/request-filter.js), just pinned to a single day.
function renderOnLeaveToday(requests) {
  const today = todayIso();
  const onLeave = requests.filter((r) => requestMatchesFilters(r, { status: "APPROVED", dateFrom: today, dateTo: today }));

  document.getElementById("on-leave-today").innerHTML = onLeave.length
    ? onLeave
        .map(
          (r) =>
            '<div class="col"><div class="card p-3 h-100">' +
            '<div class="fw-semibold">' + esc(r.employeeName) + "</div>" +
            '<div class="text-body-secondary small">' + esc(r.leaveTypeName) + "</div>" +
            '<div class="small">Back ' + formatDate(r.endDate) + "</div>" +
            "</div></div>"
        )
        .join("")
    : '<div class="col-12 text-body-secondary">No one on your team is on leave today.</div>';
}
