let allEmployees = [];
let currentFilteredEmployees = [];
let empPageNo = 0;
// hrEmployees() returns the whole list in one response (no server-side
// paging on this endpoint, unlike /directory) — pagination here just slices
// the already-fetched, already-filtered array.
const EMP_PAGE_SIZE = 20;

document.addEventListener("session-ready", function () {
  loadEmployees();
});

function loadEmployees() {
  apiClient
    .hrEmployees()
    .then((employees) => {
      allEmployees = employees;
      populateReassignManagers(employees);
      populateManagerOptions(employees);
      populateManagerFilter(employees);
      applyEmployeeFilters();
    })
    .catch((err) => {
      showError(err.message || "Could not load employees.");
    });
}

function renderEmployeePage() {
  const start = empPageNo * EMP_PAGE_SIZE;
  renderEmployeeRows(currentFilteredEmployees.slice(start, start + EMP_PAGE_SIZE));
  renderEmployeePager();
}

// Prev / "Page X of Y" / Next — same shape as js/api/directory.js's
// dirRenderPager, just driven off a client-side slice instead of a server Page.
function renderEmployeePager() {
  const total = currentFilteredEmployees.length;
  const pages = Math.max(Math.ceil(total / EMP_PAGE_SIZE), 1);
  const from = total ? empPageNo * EMP_PAGE_SIZE + 1 : 0;
  const to = Math.min(from + EMP_PAGE_SIZE - 1, total);

  document.getElementById("emp-count").textContent = total
    ? "Showing " + from + "–" + to + " of " + total + " employee(s)"
    : "No employees to show";

  const item = (label, targetPage, disabled, isLabel) =>
    '<li class="page-item' + (disabled ? " disabled" : "") + (isLabel ? " active" : "") + '">' +
    (isLabel
      ? '<span class="page-link">' + label + "</span>"
      : '<button type="button" class="page-link" data-emp-page="' + targetPage + '">' + label + "</button>") +
    "</li>";

  document.getElementById("emp-pagination").innerHTML =
    item('<i class="bi bi-chevron-left"></i><span class="visually-hidden">Previous</span>', empPageNo - 1, empPageNo <= 0) +
    item("Page " + (empPageNo + 1) + " of " + pages, null, false, true) +
    item('<i class="bi bi-chevron-right"></i><span class="visually-hidden">Next</span>', empPageNo + 1, empPageNo >= pages - 1);
}

document.getElementById("emp-pagination").addEventListener("click", function (ev) {
  const btn = ev.target.closest("[data-emp-page]");
  if (!btn) return;
  empPageNo = Number(btn.getAttribute("data-emp-page"));
  renderEmployeePage();
});

function renderEmployeeRows(employees) {
  // "Manager" isn't a stored role (see 06-auth-and-security.md) — it's
  // shown as a computed badge next to the real role, not a role value.
  const managerIds = new Set(managersOf(allEmployees).map((m) => m.id));
  document.getElementById("hr-employees-body").innerHTML = employees.length
    ? employees
        .map(
          (e) =>
            "<tr>" +
            '<td><a href="#" data-view-employee="' + e.id + '">' + esc(e.name) + "</a></td>" +
            "<td>" + esc(e.email) + "</td>" +
            "<td>" + esc(e.role) + (managerIds.has(e.id) ? ' <span class="badge text-bg-secondary">Manager</span>' : "") +
            "</td>" +
            "<td>" + renderEmployeeStatusBadge(e.status) + "</td>" +
            '<td class="text-end">' + rowActions(e) + "</td>" +
            "</tr>"
        )
        .join("")
    : '<tr><td colspan="5" class="text-center text-body-secondary py-4">No matching employees.</td></tr>';
}

// Resend is ORG_ADMIN only and only makes sense while the user is still INVITED.
function rowActions(e) {
  if (e.status !== "INVITED" || !window.__session || window.__session.role !== "ORG_ADMIN") return "";
  return '<button type="button" class="btn btn-sm btn-outline-secondary" data-resend-invite="' + e.id + '"><i class="bi bi-envelope-arrow-up"></i> Resend invite</button>';
}

document.getElementById("hr-employees-body").addEventListener("click", function (ev) {
  const resend = ev.target.closest("[data-resend-invite]");
  if (resend) {
    resend.disabled = true;
    const id = Number(resend.getAttribute("data-resend-invite"));
    apiClient
      .resendInvite(id)
      .then(() => showSuccess("Invite sent again."))
      .catch((err) => showError(err.message || "Could not resend the invite."))
      .finally(() => (resend.disabled = false));
    return;
  }
  const link = ev.target.closest("[data-view-employee]");
  if (!link) return;
  ev.preventDefault();
  openEmployeeDetailModal(Number(link.getAttribute("data-view-employee")));
});

// Only Onboarded/Active users can be offered as a reporting manager.
function populateManagerOptions(employees) {
  const options = employees.filter((e) => e.status === "ONBOARDED" || e.status === "ACTIVE").map((e) => '<option value="' + e.id + '">' + esc(e.name) + "</option>").join("");
  document.getElementById("new-emp-manager").innerHTML = '<option value="">No manager (top of hierarchy)</option>' + options;
}

let editingEmployeeId = null;
let employeeModal = null;

function getEmployeeModal() {
  // getOrCreateInstance, not `new` — the "Add employee" button opens this
  // modal via data-bs-toggle, so Bootstrap already owns an instance; `new`
  // would make a second one whose .hide() no-ops (modal stays open after save).
  if (!employeeModal) employeeModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("employee-modal"));
  return employeeModal;
}

function openEmployeeModal(employeeId) {
  const employee = allEmployees.find((e) => e.id === employeeId);
  if (!employee) return;

  editingEmployeeId = employee.id;
  document.getElementById("employee-modal-title").textContent = "Edit employment: " + employee.name;
  document.getElementById("new-emp-code").value = employee.employeeCode || "";
  document.getElementById("new-emp-name").value = employee.name || "";
  document.getElementById("new-emp-email").value = employee.email || "";
  document.getElementById("new-emp-phone").value = employee.phone || "";
  document.getElementById("new-emp-doj").value = employee.dateOfJoining || "";
  document.getElementById("new-emp-doe").value = employee.dateOfExit || "";
  document.getElementById("new-emp-type").value = employee.employeeType || "REGULAR";
  // Invited/Pending/Onboarded can only be moved to Exited: their own status is
  // shown (not selectable) and Active / On notice are disabled.
  const PRE_ACTIVE = ["INVITED", "PENDING", "ONBOARDED"];
  const preActive = PRE_ACTIVE.indexOf(employee.status) !== -1;
  const statusEl = document.getElementById("new-emp-status");
  Array.from(statusEl.options).forEach((o) => {
    o.hidden = o.disabled = o.value !== employee.status && (PRE_ACTIVE.indexOf(o.value) !== -1 || (preActive && o.value !== "EXITED"));
  });
  statusEl.value = employee.status || "ACTIVE";
  document.getElementById("status-note").hidden = !preActive;
  document.getElementById("new-emp-designation").value = employee.designation || "";
  document.getElementById("new-emp-department").value = employee.department || "";
  document.getElementById("new-emp-manager").value = employee.managerId || "";
  document.getElementById("new-emp-salary").value = employee.basicSalary != null ? employee.basicSalary : "";

  getEmployeeModal().show();
}

let viewingEmployeeId = null;
let employeeDetailModal = null;

function getEmployeeDetailModal() {
  if (!employeeDetailModal) employeeDetailModal = new bootstrap.Modal(document.getElementById("employee-detail-modal"));
  return employeeDetailModal;
}

function openEmployeeDetailModal(employeeId) {
  const employee = allEmployees.find((e) => e.id === employeeId);
  if (!employee) return;

  viewingEmployeeId = employee.id;
  document.getElementById("employee-detail-title").textContent = employee.name;
  document.getElementById("detail-code").textContent = employee.employeeCode || "—";
  document.getElementById("detail-email").innerHTML = esc(employee.email) + (employee.emailVerified
    ? ' <span class="badge text-bg-success"><i class="bi bi-patch-check-fill"></i> Verified</span>'
    : ' <span class="badge text-bg-secondary">Not verified</span>');
  document.getElementById("detail-phone").textContent = employee.phone || "—";

  const isManager = managersOf(allEmployees).some((m) => m.id === employee.id);
  document.getElementById("detail-role").innerHTML = esc(employee.role) + (isManager ? ' <span class="badge text-bg-secondary">Manager</span>' : "");

  document.getElementById("detail-status").innerHTML = renderEmployeeStatusBadge(employee.status);
  document.getElementById("detail-type").textContent = employee.employeeType || "—";
  document.getElementById("detail-designation").textContent = employee.designation || "—";
  document.getElementById("detail-department").textContent = employee.department || "—";
  document.getElementById("detail-doj").textContent = employee.dateOfJoining ? formatDate(employee.dateOfJoining) : "—";
  document.getElementById("detail-doe").textContent = employee.dateOfExit ? formatDate(employee.dateOfExit) : "—";
  document.getElementById("detail-salary").textContent = employee.basicSalary != null ? employee.basicSalary.toLocaleString() : "—";

  const manager = allEmployees.find((e) => e.id === employee.managerId);
  document.getElementById("detail-manager").textContent = manager ? manager.name : "No manager (top of hierarchy)";

  getEmployeeDetailModal().show();
}

document.getElementById("employee-detail-edit-btn").addEventListener("click", function () {
  getEmployeeDetailModal().hide();
  openEmployeeModal(viewingEmployeeId);
});

document.getElementById("employee-detail-details-btn").addEventListener("click", function () {
  getEmployeeDetailModal().hide();
  openDetailsModal(viewingEmployeeId);
});

function populateManagerFilter(employees) {
  const options = managersOf(employees)
    .map((m) => '<option value="' + m.id + '">' + esc(m.name) + "</option>")
    .join("");
  document.getElementById("filter-employee-manager").innerHTML =
    '<option value="">All managers</option><option value="NONE">No manager (top of hierarchy)</option>' + options;
}

function applyEmployeeFilters() {
  const filters = {
    search: document.getElementById("filter-employee-search").value.trim(),
    managerId: document.getElementById("filter-employee-manager").value || null,
  };
  const status = document.getElementById("filter-employee-status").value;
  if (filters.managerId && filters.managerId !== "NONE") filters.managerId = Number(filters.managerId);
  currentFilteredEmployees = allEmployees.filter((e) => employeeMatchesFilters(e, filters) && (!status || e.status === status));
  // A filter change resets to page 1 — staying on page 4 of a result set
  // that now has one page shows an empty table for no reason.
  empPageNo = 0;
  renderEmployeePage();
}

document.getElementById("filter-employee-search").addEventListener("input", applyEmployeeFilters);
document.getElementById("filter-employee-manager").addEventListener("change", applyEmployeeFilters);
document.getElementById("filter-employee-status").addEventListener("change", applyEmployeeFilters);

function showError(message) {
  const errorEl = document.getElementById("hr-employees-error");
  errorEl.textContent = message;
  errorEl.hidden = false;
  document.getElementById("hr-employees-success").hidden = true;
}

function showSuccess(message) {
  const successEl = document.getElementById("hr-employees-success");
  successEl.textContent = message;
  successEl.hidden = false;
  document.getElementById("hr-employees-error").hidden = true;
}

document.getElementById("add-employee-form").addEventListener("submit", function (ev) {
  ev.preventDefault();
  const editing = allEmployees.find((e) => e.id === editingEmployeeId);
  if (!editing) return;

  // Employment fields only: no password (users set their own) and personal
  // details go through the separate details editor. status is sent only when
  // changed, since an Invited/Pending/Onboarded user's own status is not a valid PATCH value.
  const payload = {
    employeeCode: document.getElementById("new-emp-code").value.trim(),
    name: document.getElementById("new-emp-name").value.trim(),
    email: document.getElementById("new-emp-email").value.trim(),
    phone: document.getElementById("new-emp-phone").value.trim(),
    dateOfJoining: document.getElementById("new-emp-doj").value,
    dateOfExit: document.getElementById("new-emp-doe").value || null,
    employeeType: document.getElementById("new-emp-type").value,
    designation: document.getElementById("new-emp-designation").value.trim(),
    department: document.getElementById("new-emp-department").value.trim(),
    managerId: Number(document.getElementById("new-emp-manager").value) || null,
    basicSalary: document.getElementById("new-emp-salary").value ? Number(document.getElementById("new-emp-salary").value) : null,
  };
  const status = document.getElementById("new-emp-status").value;
  if (status !== editing.status) payload.status = status;

  apiClient
    .updateHrEmployee(editingEmployeeId, payload)
    .then(() => {
      getEmployeeModal().hide();
      showSuccess("Employee updated.");
      loadEmployees();
    })
    .catch((err) => {
      showError(err.message || "Could not update employee.");
    });
});

/* ------------------------------------------------------------------
 * Details editor - PATCH /hr/employees/{id}/details. Prefilled from the
 * directory (which returns these to HR/ORG_ADMIN, bank/ID numbers masked to
 * the last 4); only fields that differ from what was loaded are sent.
 * ------------------------------------------------------------------ */
const DETAILS_MASKED = ["bankAccount", "nationalId", "taxId", "passport"];
const DETAILS_ALL = Object.keys(EMP_DETAIL_GROUPS).reduce((all, g) => all.concat(EMP_DETAIL_GROUPS[g]), ["phone"]);
const detailsForm = document.getElementById("details-form");
const detailsError = document.getElementById("details-error");
let detailsEmployeeId = null;
let detailsInitial = {};
let detailsReady = false;

// Headings between the fragment's sections; runs once the fragment is in.
window.FragmentsReady.then(function () {
  [["personal", "Personal details &amp; address"], ["emergency", "Emergency contact"], ["payIds", "Pay &amp; IDs"]].forEach(function (sec) {
    detailsForm.querySelector('[data-section="' + sec[0] + '"]').insertAdjacentHTML("beforebegin", '<h3 class="h6 mt-3 mb-2 pb-1 border-bottom">' + sec[1] + "</h3>");
  });
  initEmpDetailFields(detailsForm, false);
  detailsReady = true;
});

function openDetailsModal(employeeId) {
  const employee = allEmployees.find((e) => e.id === employeeId);
  if (!employee || !detailsReady) return;
  detailsEmployeeId = employeeId;
  detailsError.hidden = true;
  detailsForm.reset();
  detailsForm.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  document.getElementById("details-modal-title").textContent = "Edit details: " + employee.name;
  document.getElementById("details-note").textContent = "Leave a bank or ID field blank to keep its current value (shown as the last 4 characters).";

  apiClient
    .directory({ page: 0, size: 200 })
    .then(function (result) {
      const row = (result.content || []).find((r) => r.id === employeeId) || {};
      const flat = Object.assign({}, row);
      DETAILS_MASKED.forEach(function (f) {
        const el = detailsForm.querySelector('[name="' + f + '"]');
        el.placeholder = row[f] ? "Current: " + row[f] : "";
        flat[f] = "";
      });
      fillEmpFields(detailsForm, flat);
      detailsInitial = readEmpFields(detailsForm, DETAILS_ALL);
      bootstrap.Modal.getOrCreateInstance(document.getElementById("details-modal")).show();
    })
    .catch((err) => showError(err.message || "Could not load this employee's details."));
}

detailsForm.addEventListener("submit", function (ev) {
  ev.preventDefault();
  detailsError.hidden = true;
  if (!validateFields(detailsForm)) return;

  const now = readEmpFields(detailsForm, DETAILS_ALL);
  const changed = {};
  DETAILS_ALL.forEach((f) => {
    if (now[f] !== detailsInitial[f]) changed[f] = now[f];
  });
  if (!Object.keys(changed).length) {
    detailsError.textContent = "Nothing has changed.";
    detailsError.hidden = false;
    return;
  }

  apiClient
    .updateHrEmployeeDetails(detailsEmployeeId, toEmpDetailsPatch(changed))
    .then(() => {
      bootstrap.Modal.getOrCreateInstance(document.getElementById("details-modal")).hide();
      showSuccess("Details updated.");
    })
    .catch((err) => {
      // 403 = HR editing a non-EMPLOYEE row; 400 names the bad field.
      detailsError.textContent = err.message || "Could not save the details.";
      detailsError.hidden = false;
    });
});

function populateReassignManagers(employees) {
  const options = managersOf(employees)
    .map((m) => '<option value="' + m.id + '">' + esc(m.name) + "</option>")
    .join("");
  document.getElementById("reassign-from").innerHTML = '<option value="">Select a manager…</option>' + options;
  document.getElementById("reassign-to").innerHTML = '<option value="">Select a manager…</option>' + options;
  document.getElementById("reassign-employees-wrap").hidden = true;
  document.getElementById("reassign-employees").innerHTML = "";
}

document.getElementById("reassign-from").addEventListener("change", function () {
  const fromId = Number(this.value) || null;
  const reports = fromId ? directReportsOf(allEmployees, fromId) : [];
  const wrap = document.getElementById("reassign-employees-wrap");
  wrap.hidden = !reports.length;
  document.getElementById("reassign-employees").innerHTML = reports
    .map(
      (e) =>
        '<div class="form-check"><input class="form-check-input" type="checkbox" value="' + e.id + '" id="reassign-emp-' + e.id + '" checked>' +
        '<label class="form-check-label" for="reassign-emp-' + e.id + '">' + esc(e.name) + "</label></div>"
    )
    .join("");

  // Can't reassign to the manager they're already leaving, or make one of
  // the moving employees their own new manager.
  const excluded = new Set([fromId, ...reports.map((e) => e.id)]);
  const toOptions = managersOf(allEmployees)
    .filter((m) => !excluded.has(m.id))
    .map((m) => '<option value="' + m.id + '">' + esc(m.name) + "</option>")
    .join("");
  document.getElementById("reassign-to").innerHTML = '<option value="">Select a manager…</option>' + toOptions;
});

document.getElementById("reassign-form").addEventListener("submit", function (ev) {
  ev.preventDefault();
  const toId = Number(document.getElementById("reassign-to").value) || null;
  const checkedIds = Array.from(document.querySelectorAll("#reassign-employees input:checked")).map((el) => Number(el.value));

  if (!toId || !checkedIds.length) {
    showError("Pick at least one employee and a new manager.");
    return;
  }

  apiClient
    .reassignManager({ employeeIds: checkedIds, newManagerId: toId })
    .then(() => {
      ev.target.reset();
      bootstrap.Modal.getOrCreateInstance(document.getElementById("reassign-modal")).hide();
      showSuccess("Moved " + checkedIds.length + " employee(s), and their open 1:1s and in-progress appraisal reviews, to their new manager.");
      loadEmployees();
    })
    .catch((err) => {
      showError(err.message || "Could not reassign employees.");
    });
});
