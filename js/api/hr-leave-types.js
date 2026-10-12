const LEAVE_TYPE_ICON_MAP = {
  CL: "bi-briefcase",
  PL: "bi-star",
  OPTIONAL_HOLIDAY: "bi-calendar-heart",
  MARRIAGE: "bi-heart",
  MATERNITY: "bi-flower1",
  PATERNITY: "bi-person-heart",
  INTERN_STUDY: "bi-mortarboard",
  SABBATICAL: "bi-airplane",
  LOP: "bi-cash-coin",
};

let allLeaveTypes = [];

document.addEventListener("session-ready", function () {
  loadLeaveTypes();
});

function loadLeaveTypes() {
  apiClient
    .hrLeaveTypes()
    .then((types) => {
      allLeaveTypes = types;
      document.getElementById("hr-leave-types-body").innerHTML = types.length
        ? types
            .map(
              (t) =>
                "<tr>" +
                '<td><i class="bi ' + (LEAVE_TYPE_ICON_MAP[t.code] || "bi-calendar3") + ' fs-5 text-primary"></i></td>' +
                '<td><a href="#" data-edit-leave-type="' + t.id + '">' + esc(t.name) + "</a></td>" +
                "<td><code>" + esc(t.code) + "</code></td>" +
                "<td>" + esc(t.daysPerYear || "—") + "</td>" +
                "<td>" + (t.requiresAdvanceNoticeDays ? t.requiresAdvanceNoticeDays + " days" : "—") + "</td>" +
                "<td>" + (t.requiresSituationType ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-dash text-body-secondary"></i>') + "</td>" +
                "<td>" + esc(t.infoNote || "—") + "</td>" +
                "</tr>"
            )
            .join("")
        : '<tr><td colspan="7" class="text-center text-body-secondary py-4">No leave types.</td></tr>';
    })
    .catch((err) => {
      showError(err.message || "Could not load leave types.");
    });
}

document.getElementById("hr-leave-types-body").addEventListener("click", function (ev) {
  const link = ev.target.closest("[data-edit-leave-type]");
  if (!link) return;
  ev.preventDefault();
  openLeaveTypeModal(Number(link.getAttribute("data-edit-leave-type")));
});

let editingLeaveTypeId = null;
let leaveTypeModal = null;

function getLeaveTypeModal() {
  if (!leaveTypeModal) leaveTypeModal = new bootstrap.Modal(document.getElementById("leave-type-modal"));
  return leaveTypeModal;
}

function clearLeaveTypeFormFields() {
  document.getElementById("leave-type-form").reset();
  editingLeaveTypeId = null;
  document.getElementById("leave-type-modal-title").textContent = "Add leave type";
  document.getElementById("leave-type-submit-label").textContent = "Add leave type";
  document.getElementById("leave-type-delete").hidden = true;
}

document.getElementById("add-leave-type").addEventListener("click", clearLeaveTypeFormFields);

function openLeaveTypeModal(id) {
  const leaveType = allLeaveTypes.find((t) => t.id === id);
  if (!leaveType) return;

  editingLeaveTypeId = leaveType.id;
  document.getElementById("leave-type-modal-title").textContent = "Edit leave type";
  document.getElementById("lt-name").value = leaveType.name || "";
  document.getElementById("lt-code").value = leaveType.code || "";
  document.getElementById("lt-entitlement").value = leaveType.daysPerYear || "";
  document.getElementById("lt-notice").value = leaveType.requiresAdvanceNoticeDays || "";
  document.getElementById("lt-situation").checked = !!leaveType.requiresSituationType;
  document.getElementById("lt-notes").value = leaveType.infoNote || "";

  document.getElementById("leave-type-submit-label").textContent = "Save changes";
  document.getElementById("leave-type-delete").hidden = false;
  getLeaveTypeModal().show();
}

function showError(message) {
  const errorEl = document.getElementById("hr-leave-types-error");
  errorEl.textContent = message;
  errorEl.hidden = false;
  document.getElementById("hr-leave-types-success").hidden = true;
}

function showSuccess(message) {
  const successEl = document.getElementById("hr-leave-types-success");
  successEl.textContent = message;
  successEl.hidden = false;
  document.getElementById("hr-leave-types-error").hidden = true;
}

document.getElementById("leave-type-form").addEventListener("submit", function (ev) {
  ev.preventDefault();
  const editingId = editingLeaveTypeId;

  const payload = {
    name: document.getElementById("lt-name").value.trim(),
    code: document.getElementById("lt-code").value.trim(),
    daysPerYear: document.getElementById("lt-entitlement").value.trim(),
    requiresAdvanceNoticeDays: document.getElementById("lt-notice").value ? Number(document.getElementById("lt-notice").value) : null,
    requiresSituationType: document.getElementById("lt-situation").checked,
    infoNote: document.getElementById("lt-notes").value.trim(),
  };

  const request = editingId ? apiClient.updateHrLeaveType(editingId, payload) : apiClient.createHrLeaveType(payload);

  request
    .then(() => {
      getLeaveTypeModal().hide();
      clearLeaveTypeFormFields();
      showSuccess(editingId ? "Leave type updated." : "Leave type added.");
      loadLeaveTypes();
    })
    .catch((err) => {
      showError(err.message || (editingId ? "Could not update leave type." : "Could not add leave type."));
    });
});

document.getElementById("leave-type-delete").addEventListener("click", function () {
  const editingId = editingLeaveTypeId;
  if (!editingId) return;

  apiClient
    .deleteHrLeaveType(editingId)
    .then(() => {
      getLeaveTypeModal().hide();
      clearLeaveTypeFormFields();
      showSuccess("Leave type deleted.");
      loadLeaveTypes();
    })
    .catch((err) => {
      showError(err.message || "Could not delete leave type.");
    });
});
