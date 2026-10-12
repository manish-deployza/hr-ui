/* oneOnOneSessions() called by a manager returns every session where they
 * are the manager, across all direct reports (16-module-one-on-one.md:
 * "employee or manager view of their own ... sessions"), so this page just
 * cross-references that list against managerTeam() rather than needing a
 * separate team-scoped endpoint. */

document.addEventListener("session-ready", function () {
  Promise.all([apiClient.managerTeam(), apiClient.oneOnOneSessions()])
    .then(([team, sessions]) => {
      document.getElementById("team-one-on-ones-body").innerHTML = team
        .map((member) => {
          const memberSessions = sessions.filter((s) => s.employeeId === member.id);
          const session = pickMostRelevant(memberSessions);

          const sessionCell = session ? formatDateTime(session.scheduledAt) : "—";
          const statusCell = session
            ? renderBadge(session.status, ONE_ON_ONE_STATUS_BADGE_MAP)
            : '<span class="status-badge status-badge--pending">Needs scheduling</span>';
          const actionCell = session
            ? '<a href="one-on-one-view.html?id=' + encodeURIComponent(session.id) + '">Open</a>'
            : '<a href="one-on-ones.html">Schedule</a>';

          return (
            "<tr>" +
            "<td>" + esc(member.name) + "</td>" +
            "<td>" + sessionCell + "</td>" +
            "<td>" + statusCell + "</td>" +
            "<td>" + actionCell + "</td>" +
            "</tr>"
          );
        })
        .join("") || '<tr><td colspan="4" class="text-center text-body-secondary py-4">No direct reports.</td></tr>';
    })
    .catch((err) => {
      const errorEl = document.getElementById("team-one-on-ones-error");
      errorEl.textContent = err.message || "Could not load team 1:1s.";
      errorEl.hidden = false;
    });
});

// Prefer the earliest upcoming SCHEDULED session; otherwise the most recent
// by date (COMPLETED/CANCELLED); otherwise none.
function pickMostRelevant(sessions) {
  const scheduled = sessions.filter((s) => s.status === "SCHEDULED").sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  if (scheduled.length) return scheduled[0];
  const rest = sessions.slice().sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
  return rest[0] || null;
}
