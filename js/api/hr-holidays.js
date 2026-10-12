let allHolidays = [];
let editingHolidayId = null;
let holidayModal = null;

// Bounds the native date picker's year segment — without min/max Chromium
// lets typing run past 4 digits (e.g. "275760"). Recomputed from today's
// date, not hardcoded, so the allowed range rolls forward every year.
const currentYear = new Date().getFullYear();
document.getElementById("h-date").min = currentYear + "-01-01";
document.getElementById("h-date").max = (currentYear + 2) + "-12-31";

document.addEventListener("session-ready", function () {
  const yearFilter = document.getElementById("holidays-year-filter");
  yearFilter.innerHTML = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
    .map((y) => '<option value="' + y + '"' + (y === currentYear ? " selected" : "") + ">" + y + "</option>")
    .join("");
  loadHolidays();
});

document.getElementById("holidays-year-filter").addEventListener("change", loadHolidays);

function loadHolidays() {
  const year = Number(document.getElementById("holidays-year-filter").value) || currentYear;
  apiClient
    .hrHolidays(year)
    .then((holidays) => {
      allHolidays = holidays;
      document.getElementById("holidays-title").textContent = "Holidays — " + year;
      renderHolidayGroup("national-holidays-body", holidays.filter((h) => h.nonNegotiable));
      renderHolidayGroup("other-holidays-body", holidays.filter((h) => !h.nonNegotiable));
    })
    .catch((err) => showError(err.message || "Could not load holidays."));
}

function renderHolidayGroup(bodyId, holidays) {
  document.getElementById(bodyId).innerHTML = holidays.length
    ? holidays
        .map(
          (h) =>
            "<tr>" +
            '<td><a href="#" data-edit-holiday="' + h.id + '">' + esc(h.name) + "</a></td>" +
            "<td>" + formatDate(h.date) + "</td>" +
            "<td>" + esc(new Date(h.date).toLocaleDateString(undefined, { weekday: "long" })) + "</td>" +
            "</tr>"
        )
        .join("")
    : '<tr><td colspan="3" class="text-center text-body-secondary py-4">None.</td></tr>';
}

document.addEventListener("click", function (ev) {
  const link = ev.target.closest("[data-edit-holiday]");
  if (!link) return;
  ev.preventDefault();
  openHolidayModal(Number(link.getAttribute("data-edit-holiday")));
});

function getHolidayModal() {
  // getOrCreateInstance, not `new` — "Add Holiday" opens this via
  // data-bs-toggle, which creates its own Modal instance on first click;
  // `new` here would create a second, competing instance (see
  // hr-leave-types.js's getLeaveTypeModal for the same fix).
  if (!holidayModal) holidayModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("holiday-modal"));
  return holidayModal;
}

function clearHolidayFormFields() {
  document.getElementById("holiday-form").reset();
  editingHolidayId = null;
  document.getElementById("holiday-modal-title").textContent = "Add Holiday";
  document.getElementById("holiday-submit-label").textContent = "Add Holiday";
  document.getElementById("holiday-delete").hidden = true;
}

document.getElementById("add-holiday").addEventListener("click", clearHolidayFormFields);

function openHolidayModal(id) {
  const holiday = allHolidays.find((h) => h.id === id);
  if (!holiday) return;

  editingHolidayId = holiday.id;
  document.getElementById("holiday-modal-title").textContent = "Edit Holiday";
  document.getElementById("h-name").value = holiday.name || "";
  document.getElementById("h-date").value = holiday.date || "";
  document.getElementById("h-non-negotiable").checked = !!holiday.nonNegotiable;
  document.getElementById("holiday-submit-label").textContent = "Save changes";
  document.getElementById("holiday-delete").hidden = false;
  getHolidayModal().show();
}

function showError(message) {
  const errorEl = document.getElementById("hr-holidays-error");
  errorEl.textContent = message;
  errorEl.hidden = false;
  document.getElementById("hr-holidays-success").hidden = true;
}

function showSuccess(message) {
  const successEl = document.getElementById("hr-holidays-success");
  successEl.textContent = message;
  successEl.hidden = false;
  document.getElementById("hr-holidays-error").hidden = true;
}

document.getElementById("holiday-form").addEventListener("submit", function (ev) {
  ev.preventDefault();
  const editingId = editingHolidayId;

  const payload = {
    name: document.getElementById("h-name").value.trim(),
    date: document.getElementById("h-date").value,
    nonNegotiable: document.getElementById("h-non-negotiable").checked,
  };

  const request = editingId ? apiClient.updateHrHoliday(editingId, payload) : apiClient.createHrHoliday(payload);

  request
    .then(() => {
      getHolidayModal().hide();
      clearHolidayFormFields();
      showSuccess(editingId ? "Holiday updated." : "Holiday added.");
      loadHolidays();
    })
    .catch((err) => {
      showError(err.message || (editingId ? "Could not update holiday." : "Could not add holiday."));
    });
});

document.getElementById("holiday-delete").addEventListener("click", function () {
  const editingId = editingHolidayId;
  if (!editingId) return;

  apiClient
    .deleteHrHoliday(editingId)
    .then(() => {
      getHolidayModal().hide();
      clearHolidayFormFields();
      showSuccess("Holiday deleted.");
      loadHolidays();
    })
    .catch((err) => {
      showError(err.message || "Could not delete holiday.");
    });
});
