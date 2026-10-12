let allEmployees = [];

document.addEventListener("session-ready", function () {
  loadEmployees();
});

function loadEmployees() {
  apiClient
    .hrEmployees()
    .then((employees) => {
      allEmployees = employees;
      renderEmployeeRows(employees);
      populateReassignManagers(employees);
      populateManagerOptions(employees);
      populateManagerFilter(employees);
    })
    .catch((err) => {
      showError(err.message || "Could not load employees.");
    });
}

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
            "<td>" + esc(e.role) + (managerIds.has(e.id) ? ' <span class="badge text-bg-secondary">Manager</span>' : "") + "</td>" +
            "</tr>"
        )
        .join("")
    : '<tr><td colspan="3" class="text-center text-body-secondary py-4">No matching employees.</td></tr>';
}

document.getElementById("hr-employees-body").addEventListener("click", function (ev) {
  const link = ev.target.closest("[data-view-employee]");
  if (!link) return;
  ev.preventDefault();
  openEmployeeDetailModal(Number(link.getAttribute("data-view-employee")));
});

function populateManagerOptions(employees) {
  const options = employees.map((e) => '<option value="' + e.id + '">' + esc(e.name) + "</option>").join("");
  document.getElementById("new-emp-manager").innerHTML = '<option value="">No manager (top of hierarchy)</option>' + options;
}

let editingEmployeeId = null;
let employeeModal = null;

function getEmployeeModal() {
  if (!employeeModal) employeeModal = new bootstrap.Modal(document.getElementById("employee-modal"));
  return employeeModal;
}

function clearEmployeeFormFields() {
  document.getElementById("add-employee-form").reset();
  editingEmployeeId = null;
  document.getElementById("new-emp-password").required = true;
  document.getElementById("new-emp-password").placeholder = "";
  document.getElementById("employee-modal-title").textContent = "Add employee";
  document.getElementById("add-employee-submit-label").textContent = "Add employee";
}

// "Add employee" button opens the modal fresh via data-bs-toggle; this just
// resets the fields it's about to reveal so a previous edit's data can't leak in.
document.getElementById("add-employee").addEventListener("click", clearEmployeeFormFields);

function openEmployeeModal(employeeId) {
  const employee = allEmployees.find((e) => e.id === employeeId);
  if (!employee) return;

  editingEmployeeId = employee.id;
  document.getElementById("employee-modal-title").textContent = "Edit employee";
  document.getElementById("new-emp-code").value = employee.employeeCode || "";
  document.getElementById("new-emp-name").value = employee.name || "";
  document.getElementById("new-emp-email").value = employee.email || "";
  document.getElementById("new-emp-phone").value = employee.phone || "";
  document.getElementById("new-emp-doj").value = employee.dateOfJoining || "";
  document.getElementById("new-emp-doe").value = employee.dateOfExit || "";
  document.getElementById("new-emp-type").value = employee.employeeType || "REGULAR";
  document.getElementById("new-emp-status").value = employee.status || "ACTIVE";
  document.getElementById("new-emp-designation").value = employee.designation || "";
  document.getElementById("new-emp-department").value = employee.department || "";
  document.getElementById("new-emp-manager").value = employee.managerId || "";
  document.getElementById("new-emp-salary").value = employee.basicSalary != null ? employee.basicSalary : "";
  document.getElementById("new-emp-role").value = employee.role || "EMPLOYEE";

  // Editing doesn't force a password reset — leave it blank to keep the
  // existing one, only sent if HR actually types a new one.
  const passwordEl = document.getElementById("new-emp-password");
  passwordEl.value = "";
  passwordEl.required = false;
  passwordEl.placeholder = "Leave blank to keep current password";
  document.getElementById("new-emp-force-reset").checked = false;

  document.getElementById("add-employee-submit-label").textContent = "Save changes";
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
  document.getElementById("detail-email").textContent = employee.email;
  document.getElementById("detail-phone").textContent = employee.phone || "—";

  const isManager = managersOf(allEmployees).some((m) => m.id === employee.id);
  document.getElementById("detail-role").innerHTML = esc(employee.role) + (isManager ? ' <span class="badge text-bg-secondary">Manager</span>' : "");

  document.getElementById("detail-status").textContent = employee.status || "—";
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
  if (filters.managerId && filters.managerId !== "NONE") filters.managerId = Number(filters.managerId);
  renderEmployeeRows(allEmployees.filter((e) => employeeMatchesFilters(e, filters)));
}

document.getElementById("filter-employee-search").addEventListener("input", applyEmployeeFilters);
document.getElementById("filter-employee-manager").addEventListener("change", applyEmployeeFilters);

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
  const editingId = editingEmployeeId;
  const password = document.getElementById("new-emp-password").value;

  const payload = {
    employeeCode: document.getElementById("new-emp-code").value.trim(),
    name: document.getElementById("new-emp-name").value.trim(),
    email: document.getElementById("new-emp-email").value.trim(),
    phone: document.getElementById("new-emp-phone").value.trim(),
    forcePasswordReset: document.getElementById("new-emp-force-reset").checked,
    dateOfJoining: document.getElementById("new-emp-doj").value,
    dateOfExit: document.getElementById("new-emp-doe").value || null,
    employeeType: document.getElementById("new-emp-type").value,
    designation: document.getElementById("new-emp-designation").value.trim(),
    department: document.getElementById("new-emp-department").value.trim(),
    managerId: Number(document.getElementById("new-emp-manager").value) || null,
    basicSalary: document.getElementById("new-emp-salary").value ? Number(document.getElementById("new-emp-salary").value) : null,
    role: document.getElementById("new-emp-role").value,
    status: document.getElementById("new-emp-status").value,
  };
  // Only send a password when one was actually typed — required on create,
  // optional on edit (blank means "keep the current one").
  if (password) payload.password = password;

  const request = editingId ? apiClient.updateHrEmployee(editingId, payload) : apiClient.createHrEmployee(payload);

  request
    .then(() => {
      getEmployeeModal().hide();
      clearEmployeeFormFields();
      showSuccess(editingId ? "Employee updated." : "Employee added.");
      loadEmployees();
    })
    .catch((err) => {
      showError(err.message || (editingId ? "Could not update employee." : "Could not add employee."));
    });
});

document.getElementById("bulk-upload-form").addEventListener("submit", function (ev) {
  ev.preventDefault();
  const file = document.getElementById("bulk-upload-file").files[0];
  if (!file) return;

  file
    .text()
    .then((text) => {
      const rows = parseDelimited(text);
      if (!rows.length) {
        showError("No rows found in file.");
        return;
      }
      return Promise.all(
        rows.map((r) => {
          // "Manager" isn't a role (role is EMPLOYEE/HR_ADMIN only, per
          // 02-database-schema.md) — a "manager" column names who this row
          // reports to, resolved against already-existing employees by name.
          const manager = r.manager ? allEmployees.find((e) => e.name.toLowerCase() === r.manager.trim().toLowerCase()) : null;
          return apiClient.createHrEmployee({
            name: r.name,
            email: r.email,
            role: (r.role || "EMPLOYEE").toUpperCase(),
            managerId: manager ? manager.id : null,
          });
        })
      ).then(() => {
        ev.target.reset();
        bootstrap.Modal.getOrCreateInstance(document.getElementById("bulk-upload-modal")).hide();
        showSuccess("Added " + rows.length + " employee(s).");
        loadEmployees();
      });
    })
    .catch((err) => {
      showError(err.message || "Could not process the file.");
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
