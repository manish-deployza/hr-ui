document.addEventListener("session-ready", function (e) {
  const session = e.detail;
  loadSessions();
  initScheduleForm(session);
});

function loadSessions() {
  apiClient
    .oneOnOneSessions()
    .then((sessions) => {
      document.getElementById("sessions-body").innerHTML = sessions.length
        ? sessions
            .map(
              (s) =>
                "<tr>" +
                "<td>" + esc(s.otherPartyName) + "</td>" +
                "<td>" + formatDateTime(s.scheduledAt) + "</td>" +
                "<td>" + renderBadge(s.status, ONE_ON_ONE_STATUS_BADGE_MAP) + "</td>" +
                '<td><a href="one-on-one-view.html?id=' + encodeURIComponent(s.id) + '">Open</a></td>' +
                "</tr>"
            )
            .join("")
        : '<tr><td colspan="4" class="text-center text-body-secondary py-4">No 1:1 sessions yet.</td></tr>';
    })
    .catch((err) => {
      const errorEl = document.getElementById("sessions-error");
      errorEl.textContent = err.message || "Could not load sessions.";
      errorEl.hidden = false;
    });
}

// A manager picks which direct report the ad-hoc session is with; an
// employee has exactly one manager, so no picker is needed — the session is
// implicitly scheduled with them (16-module-one-on-one.md: either party can
// create an ad-hoc session).
function initScheduleForm(session) {
  const withWrap = document.getElementById("session-with-wrap");
  const withInput = document.getElementById("session-with");
  const withOptions = document.getElementById("session-with-options");
  const sessionModal = new bootstrap.Modal(document.getElementById("session-modal"));
  let nameToId = {};

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("session-datetime").min = now.toISOString().slice(0, 16);

  if (session.isManager) {
    withWrap.hidden = false;
    apiClient.managerTeam().then((team) => {
      nameToId = {};
      team.forEach((m) => { nameToId[m.name] = m.id; });
      withOptions.innerHTML = team.map((m) => '<option value="' + esc(m.name) + '">').join("");
    });
  } else if (session.managerName) {
    withWrap.hidden = false;
    withOptions.innerHTML = '<option value="' + esc(session.managerName) + '">';
  }

  document.getElementById("new-session-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const payload = { scheduledAt: document.getElementById("session-datetime").value };
    if (session.isManager) {
      const employeeId = nameToId[withInput.value];
      if (!employeeId) {
        const errorEl = document.getElementById("sessions-error");
        errorEl.textContent = "Pick a team member from the list.";
        errorEl.hidden = false;
        return;
      }
      payload.employeeId = employeeId;
    }

    apiClient
      .createOneOnOneSession(payload)
      .then(() => {
        ev.target.reset();
        sessionModal.hide();
        loadSessions();
      })
      .catch((err) => {
        const errorEl = document.getElementById("sessions-error");
        errorEl.textContent = err.message || "Could not schedule the session.";
        errorEl.hidden = false;
      });
  });
}
