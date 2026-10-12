/* Helpers for components/emp-details.html, shared by onboarding.html and the
 * HR/admin details editor (hr-employees.html). Field names are the backend's
 * JSON keys (employee-onboarding.md). Load after utils.js (countries(), esc()). */

// Wizard steps = PUT bodies of /api/onboarding/{personal,emergency,pay-ids}.
const EMP_DETAIL_STEPS = {
  personal: ["phone", "dateOfBirth", "gender", "nationality", "maritalStatus", "bloodGroup", "personalEmail",
    "address1", "address2", "city", "landmark", "postalCode", "state", "country"],
  emergency: ["emergencyName", "emergencyRelationship", "emergencyPhone"],
  payIds: ["bankAccount", "bankIfsc", "nationalId", "taxId", "passport"],
};

// Where each field sits in PATCH /api/hr/employees/{id}/details (EmpDetailsForm).
const EMP_DETAIL_GROUPS = {
  personalInfo: ["dateOfBirth", "gender", "nationality", "maritalStatus", "bloodGroup", "personalEmail"],
  address: ["address1", "address2", "city", "landmark", "postalCode", "state", "country"],
  emergencyContact: EMP_DETAIL_STEPS.emergency,
  payIds: EMP_DETAIL_STEPS.payIds,
};

/* Fills country selects, caps date of birth at yesterday, adds a feedback line
 * under every input (validateFields toggles it), and — when requireMandatory —
 * turns data-req into `required` with a visible asterisk. */
function initEmpDetailFields(root, requireMandatory) {
  const options = countries().map((c) => '<option value="' + c.code + '">' + esc(c.label) + "</option>").join("");
  root.querySelectorAll("select[data-countries]").forEach((el) => {
    el.innerHTML = '<option value="">Select…</option>' + options;
  });

  const y = new Date();
  y.setDate(y.getDate() - 1);
  const dob = root.querySelector('[name="dateOfBirth"]');
  if (dob) dob.max = y.toISOString().slice(0, 10);

  root.querySelectorAll("[name]").forEach((el) => {
    if (requireMandatory && el.hasAttribute("data-req")) {
      el.required = true;
      const label = root.querySelector('label[for="' + el.id + '"]');
      if (label) label.insertAdjacentHTML("beforeend", '<span class="text-danger" aria-hidden="true"> *</span>');
    }
    const group = el.closest(".input-group");
    if (group && !group.parentElement.querySelector(".invalid-feedback")) {
      group.insertAdjacentHTML("afterend", '<div class="invalid-feedback">' + (requireMandatory && el.required ? "This field is required and must be valid." : "Please enter a valid value.") + "</div>");
    }
  });
}

// OnboardingData / PATCH-shaped nesting -> one flat {field: value} map.
function flattenEmpData(d) {
  d = d || {};
  return Object.assign({ phone: d.phone }, d.personalInfo, d.address, d.emergencyContact, {
    bankAccount: d.bankAccount, bankIfsc: d.bankIfsc, nationalId: d.nationalId, taxId: d.taxId, passport: d.passport,
  });
}

function fillEmpFields(root, flat) {
  root.querySelectorAll("[name]").forEach((el) => {
    if (el.name in flat) el.value = flat[el.name] == null ? "" : flat[el.name];
  });
}

function readEmpFields(root, names) {
  const out = {};
  names.forEach((n) => {
    const el = root.querySelector('[name="' + n + '"]');
    out[n] = el ? el.value.trim() : "";
  });
  return out;
}

// {field: value} of changed fields -> EmpDetailsForm; untouched sections are omitted (null = unchanged).
function toEmpDetailsPatch(changed) {
  const patch = {};
  if ("phone" in changed) patch.phone = changed.phone;
  Object.keys(EMP_DETAIL_GROUPS).forEach((group) => {
    const part = {};
    EMP_DETAIL_GROUPS[group].forEach((f) => {
      if (f in changed) part[f] = changed[f];
    });
    if (Object.keys(part).length) patch[group] = part;
  });
  return patch;
}
