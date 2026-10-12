let allHrRequests = [];
let employeesById = {};
let session = null;
let requestModal = null;

document.addEventListener("session-ready", function (e) {
  session = e.detail;
  apiClient
    .hrEmployees()
    .then((employees) => {
      employeesById = {};
      employees.forEach((emp) => (employeesById[emp.id] = emp));
    })
    .catch(() => {});

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

function getRequestModal() {
  if (!requestModal) requestModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("request-modal"));
  return requestModal;
}

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
            '<td><a href="#" data-request-id="' + encodeURIComponent(r.id) + '">Review</a></td>' +
            "</tr>"
        )
        .join("")
    : '<tr><td colspan="5" class="text-center text-body-secondary py-4">No matching requests.</td></tr>';
}

document.getElementById("hr-requests-body").addEventListener("click", function (ev) {
  const link = ev.target.closest("[data-request-id]");
  if (!link) return;
  ev.preventDefault();
  openRequestModal(link.getAttribute("data-request-id"));
});

function openRequestModal(id) {
  document.getElementById("modal-action-error").hidden = true;
  apiClient.getLeaveRequest(id).then((request) => {
    document.getElementById("modal-detail-employee").textContent = request.employeeName || "—";
    document.getElementById("modal-detail-employee-id").textContent = request.employeeId != null ? request.employeeId : "—";
    document.getElementById("modal-detail-type").textContent = request.leaveTypeName;
    document.getElementById("modal-detail-dates").textContent = formatDate(request.startDate) + " – " + formatDate(request.endDate);
    document.getElementById("modal-detail-requested").textContent = formatDateTime(request.appliedAt) || "—";
    document.getElementById("modal-detail-status").innerHTML = renderStatusBadge(request.status);
    document.getElementById("modal-detail-reason").textContent = request.reason || "—";

    renderApprovalTimeline(document.getElementById("modal-approval-timeline"), request.approvals || [], employeesById);

    const currentStep = (request.approvals || []).find((s) => s.action === "PENDING");
    const canAct = currentStep && ((currentStep.approverRole === "MANAGER" && session.isManager) || (currentStep.approverRole === "HR" && session.role === "HR"));
    document.getElementById("modal-approve-btn").hidden = !canAct;
    document.getElementById("modal-reject-btn").hidden = !canAct;
    document.getElementById("modal-approve-btn").onclick = () => actOnRequest(id, "APPROVED");
    document.getElementById("modal-reject-btn").onclick = () => actOnRequest(id, "REJECTED");

    getRequestModal().show();
  });
}

function actOnRequest(id, action) {
  const errorEl = document.getElementById("modal-action-error");
  errorEl.hidden = true;
  apiClient
    .actOnLeaveRequest(id, action)
    .then(() => {
      getRequestModal().hide();
      apiClient.hrRequests().then((requests) => {
        allHrRequests = requests;
        renderHrRequests(requests.filter((r) => requestMatchesFilters(r, currentFilters())));
      });
    })
    .catch((err) => {
      errorEl.textContent = err.message || "Could not record decision.";
      errorEl.hidden = false;
    });
}

["filter-employee", "filter-leave-type", "filter-status", "filter-date-from", "filter-date-to"].forEach((id) => {
  document.getElementById(id).addEventListener("input", function () {
    const filters = currentFilters();
    renderHrRequests(allHrRequests.filter((r) => requestMatchesFilters(r, filters)));
  });
});
