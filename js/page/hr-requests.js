let allHrRequests = [];

document.addEventListener("session-ready", function () {
  apiClient
    .hrRequests()
    .then((requests) => {
      allHrRequests = requests;
      populateFilterOptions(requests);
      renderHrRequests(requests);
    })
    .catch((err) => {
      const errorEl = document.getElementById("hr-requests-error");
      errorEl.textContent = err.message || "Could not load requests.";
      errorEl.hidden = false;
    });
});

// Every filter's choices/bounds come from the loaded requests, not a
// hardcoded list — a status or leave type nobody currently has doesn't
// clutter the dropdown, and the date pickers won't offer a range with no
// data in it.
function populateFilterOptions(requests) {
  const employeeNames = Array.from(new Set(requests.map((r) => r.employeeName).filter(Boolean))).sort();
  document.getElementById("filter-employee-options").innerHTML = employeeNames.map((name) => '<option value="' + esc(name) + '">').join("");

  const leaveTypeNames = Array.from(new Set(requests.map((r) => r.leaveTypeName).filter(Boolean))).sort();
  const leaveTypeSelect = document.getElementById("filter-leave-type");
  leaveTypeNames.forEach((name) => {
    leaveTypeSelect.insertAdjacentHTML("beforeend", '<option value="' + esc(name) + '">' + esc(name) + "</option>");
  });

  const statuses = Array.from(new Set(requests.map((r) => r.status).filter(Boolean)));
  const statusSelect = document.getElementById("filter-status");
  statuses.forEach((status) => {
    const label = (STATUS_BADGE_MAP[status] || {}).label || status;
    statusSelect.insertAdjacentHTML("beforeend", '<option value="' + status + '">' + esc(label) + "</option>");
  });

  const startDates = requests.map((r) => r.startDate).filter(Boolean).sort();
  const endDates = requests.map((r) => r.endDate).filter(Boolean).sort();
  if (startDates.length) {
    document.getElementById("filter-date-from").min = startDates[0];
    document.getElementById("filter-date-to").min = startDates[0];
  }
  if (endDates.length) {
    document.getElementById("filter-date-from").max = endDates[endDates.length - 1];
    document.getElementById("filter-date-to").max = endDates[endDates.length - 1];
  }
}

function currentFilters() {
  return {
    employee: document.getElementById("filter-employee").value.trim(),
    leaveType: document.getElementById("filter-leave-type").value,
    status: document.getElementById("filter-status").value,
    dateFrom: document.getElementById("filter-date-from").value,
    dateTo: document.getElementById("filter-date-to").value,
  };
}

function renderHrRequests(requests) {
  document.getElementById("hr-requests-body").innerHTML = requests.length
    ? requests
        .map(
          (r) =>
            "<tr>" +
            "<td>" + esc(r.employeeName || "—") + "</td>" +
            "<td>" + esc(r.leaveTypeName) + "</td>" +
            "<td>" + formatDate(r.startDate) + " – " + formatDate(r.endDate) + "</td>" +
            "<td>" + renderStatusBadge(r.status) + "</td>" +
            '<td><a href="leave-view.html?id=' + encodeURIComponent(r.id) + '">Review</a></td>' +
            "</tr>"
        )
        .join("")
    : '<tr><td colspan="5" class="text-center text-body-secondary py-4">No matching requests.</td></tr>';
}

["filter-employee", "filter-leave-type", "filter-status", "filter-date-from", "filter-date-to"].forEach((id) => {
  document.getElementById(id).addEventListener("input", function () {
    const filters = currentFilters();
    renderHrRequests(allHrRequests.filter((r) => requestMatchesFilters(r, filters)));
  });
});
