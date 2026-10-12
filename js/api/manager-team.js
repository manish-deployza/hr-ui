/* Direct reports table, like hr-employees.html's employee list — clicking a
 * name opens a read-only popup (js/page/hr-employees.js's detail-modal
 * pattern) showing leave balances, today's leave status, and upcoming leave
 * requests. Requests are matched to a member by name, not id — the summary
 * rows managerTeamRequests() returns don't carry employeeId (js/api/api-client-mock.js
 * toSummaryRow), same as manager-team-requests.js's own filters. */

let allTeam = [];
let requestsByEmployeeName = {};
let viewingMemberId = null;
let memberDetailModal = null;

document.addEventListener("session-ready", function () {
  Promise.all([apiClient.managerTeam(), apiClient.managerTeamRequests()]).then(([team, requests]) => {
    allTeam = team;
    requestsByEmployeeName = groupByEmployeeName(requests);
    renderTeamRows(team);
    renderOnLeaveToday(requests);
  });
});

// Table instead of js/leave-balance-card.js's card grid — cleaner for a
// modal already showing two other sections underneath it.
function renderBalanceTable(container, balances) {
  container.innerHTML = balances.length
    ? balances
        .map((b) => "<tr><td>" + esc(b.leaveTypeName) + '</td><td class="text-end fw-semibold">' + esc(formatBalance(b.balance)) + "</td></tr>")
        .join("")
    : '<tr><td colspan="2" class="text-body-secondary small">No leave balances configured.</td></tr>';
}

function groupByEmployeeName(requests) {
  const map = {};
  requests.forEach((r) => {
    (map[r.employeeName] = map[r.employeeName] || []).push(r);
  });
  return map;
}

function onLeaveNow(memberName) {
  const today = todayIso();
  return (requestsByEmployeeName[memberName] || []).find((r) => r.status === "APPROVED" && r.startDate <= today && today <= r.endDate);
}

function renderTeamRows(team) {
  document.getElementById("team-list-body").innerHTML = team.length
    ? team
        .map(
          (m) =>
            '<tr class="team-member">' +
            '<td><a href="#" data-view-member="' + m.id + '">' + esc(m.name) + "</a></td>" +
            "<td>" + esc(m.designation || "—") + "</td>" +
            "<td>" + esc(m.department || "—") + "</td>" +
            "</tr>"
        )
        .join("")
    : '<tr><td colspan="3" class="text-center text-body-secondary py-4">No direct reports.</td></tr>';
}

document.getElementById("team-list-body").addEventListener("click", function (ev) {
  const link = ev.target.closest("[data-view-member]");
  if (!link) return;
  ev.preventDefault();
  openMemberModal(Number(link.getAttribute("data-view-member")));
});

function getMemberModal() {
  if (!memberDetailModal) memberDetailModal = new bootstrap.Modal(document.getElementById("member-detail-modal"));
  return memberDetailModal;
}

function openMemberModal(memberId) {
  const member = allTeam.find((m) => m.id === memberId);
  if (!member) return;
  viewingMemberId = memberId;

  document.getElementById("member-detail-title").textContent = member.name;
  document.getElementById("member-detail-subtitle").textContent = [member.designation, member.department].filter(Boolean).join(" · ");

  renderBalanceTable(document.getElementById("member-detail-balances"), member.balances);

  const onLeave = onLeaveNow(member.name);
  document.getElementById("member-detail-on-leave").innerHTML = onLeave
    ? renderStatusBadge("APPROVED") + ' <span class="ms-2">' + esc(onLeave.leaveTypeName) + " · back " + formatDate(onLeave.endDate) + "</span>"
    : '<span class="text-body-secondary small">Not on leave today.</span>';

  const today = todayIso();
  const upcoming = (requestsByEmployeeName[member.name] || [])
    .filter((r) => r.startDate > today && ["PENDING_MANAGER", "PENDING_HR", "APPROVED"].indexOf(r.status) !== -1)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  document.getElementById("member-detail-upcoming").innerHTML = upcoming.length
    ? upcoming
        .map(
          (r) =>
            '<div class="d-flex justify-content-between align-items-center py-2 border-bottom">' +
            "<div>" +
            "<div>" + esc(r.leaveTypeName) + "</div>" +
            '<div class="text-body-secondary small">' + formatDate(r.startDate) + " – " + formatDate(r.endDate) + "</div>" +
            "</div>" +
            renderStatusBadge(r.status) +
            "</div>"
        )
        .join("")
    : '<div class="text-body-secondary small">No upcoming leave requests.</div>';

  getMemberModal().show();
}

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
