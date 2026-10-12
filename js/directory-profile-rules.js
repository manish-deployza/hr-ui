/* Address / emergency-contact requiredness rules (pure, unit-tested in
 * directory-profile-rules.test.js) plus validateFields(), the form-validation
 * glue that onboarding.html and hr-employees.html call. The old all-or-nothing
 * address DOM glue below is unused since onboarding made those fields fixed
 * (employee-onboarding.md); delete it together with its test when convenient.
 *
 * Split in two, mirroring js/directory-scope.js's convention: pure functions
 * first (no DOM), then thin DOM glue. */

/* Countries where a postal code and/or a state is genuinely required. A full
 * per-country matrix is ~250 rows nobody maintains, and getting it wrong
 * rejects legitimate addresses — so this is a short list and everywhere else
 * both fields stay optional. Expand on demand. */
const DIR_POSTAL_REQUIRED = ["US", "CA", "IN", "GB", "AU", "BR"];
const DIR_STATE_REQUIRED = ["US", "CA", "IN", "AU", "BR"];
// Countries where a landmark is a normal part of an address. This is a
// DISPLAY rule only — a landmark typed for any other country is still saved,
// never rejected.
const DIR_LANDMARK_COUNTRIES = ["IN", "BD", "PK", "LK", "NP", "AE", "SA", "EG", "NG", "KE", "BR", "MX", "ID", "PH"];

function dirNormalizeText(value) {
  return (value || "").trim();
}

/* Address fields are all-or-nothing: once any one is filled, street, city
 * and country become required, plus postal/state where the country needs
 * them. Enforced here because hbm2ddl can't add NOT NULL to a populated
 * table — the DB will not hold this line, so the form has to. Pure: given
 * the current field values, returns which fields must be required right now. */
function addressRequiredness(values) {
  values = values || {};
  const fields = ["address1", "address2", "city", "landmark", "postalCode", "state", "country"];
  const anyFilled = fields.some((f) => dirNormalizeText(values[f]) !== "");
  const code = values.country || "";
  return {
    address1: anyFilled,
    city: anyFilled,
    country: anyFilled,
    postalCode: anyFilled && DIR_POSTAL_REQUIRED.indexOf(code) !== -1,
    state: anyFilled && DIR_STATE_REQUIRED.indexOf(code) !== -1,
  };
}

// Emergency contact: all three together or none.
function emergencyRequiredness(values) {
  values = values || {};
  const anyEmergency = ["emergencyName", "emergencyRelationship", "emergencyPhone"].some(
    (f) => dirNormalizeText(values[f]) !== ""
  );
  return {
    emergencyName: anyEmergency,
    emergencyRelationship: anyEmergency,
    emergencyPhone: anyEmergency,
  };
}

/* Never hide a landmark that's already been typed — the country switch is
 * meant to stop offering the field where it's noise, not to disappear
 * something the caller just entered. */
function shouldHideLandmark(values) {
  values = values || {};
  const code = values.country || "";
  const landmarkHasValue = dirNormalizeText(values.landmark) !== "";
  return code !== "" && !landmarkHasValue && DIR_LANDMARK_COUNTRIES.indexOf(code) === -1;
}

if (typeof module !== "undefined") {
  module.exports = {
    DIR_POSTAL_REQUIRED,
    DIR_STATE_REQUIRED,
    DIR_LANDMARK_COUNTRIES,
    addressRequiredness,
    emergencyRequiredness,
    shouldHideLandmark,
  };
}

/* ------------------------------------------------------------------
 * DOM glue. The reused fragments (components/dir-personal.html,
 * dir-address.html) carry the same element ids wherever they're included,
 * and each page includes them at most once, so plain getElementById/
 * querySelector-by-name is enough — no scoped root needed except for
 * validateFields, which runs over either one wizard step or a whole flat
 * form depending on the caller.
 * ------------------------------------------------------------------ */

function dirFieldValue(name) {
  const el = document.querySelector('[name="' + name + '"]');
  return el ? el.value : "";
}

function dirSetRequired(name, on) {
  const el = document.querySelector('[name="' + name + '"]');
  if (el) el.required = !!on;
}

function applyAddressRules() {
  const country = document.getElementById("dir-country");
  if (!country) return; // fragment not on this page, or sensitive steps removed for a non-admin

  const values = {};
  ["address1", "address2", "city", "landmark", "postalCode", "state", "country",
    "emergencyName", "emergencyRelationship", "emergencyPhone"].forEach((f) => {
    values[f] = dirFieldValue(f);
  });

  const addressReq = addressRequiredness(values);
  Object.keys(addressReq).forEach((f) => dirSetRequired(f, addressReq[f]));

  const emergencyReq = emergencyRequiredness(values);
  Object.keys(emergencyReq).forEach((f) => dirSetRequired(f, emergencyReq[f]));

  // See dirApplyAddressRules's original comment: never hide a landmark that's
  // already been typed, the DOM stays visible either way once there's a value.
  const wrap = document.getElementById("dir-landmark-wrap");
  if (wrap) wrap.hidden = shouldHideLandmark(values);
}

// countries()/countryName() live in js/utils.js — shared with signup's
// country select. ISO 3166-2 SUBDIVISION codes (state/region) are NOT
// available from Intl (country codes only), which is why `state` stays a
// free-text field.
function populateCountrySelects() {
  const options = countries()
    .map((c) => '<option value="' + c.code + '">' + esc(c.label) + "</option>")
    .join("");
  const nationality = document.getElementById("dir-nationality");
  if (nationality) nationality.innerHTML = '<option value="">Not stated</option>' + options;
  const country = document.getElementById("dir-country");
  if (country) country.innerHTML = '<option value="">Select…</option>' + options;
}

/* Runs constraint validation over every input/select/textarea inside rootEl,
 * paints .is-invalid + .invalid-feedback on the ones that fail, focuses the
 * first bad one, and returns whether the whole thing passed. Used for a
 * single wizard step (js/api/directory.js) and for a whole un-paginated form
 * (js/api/set-password.js, js/api/complete-profile.js) alike. The form
 * carries `novalidate` so this is the only thing that ever blocks submit. */
function validateFields(rootEl) {
  applyAddressRules();
  let firstBad = null;
  rootEl.querySelectorAll("input, select, textarea").forEach(function (el) {
    const valid = el.checkValidity();
    el.classList.toggle("is-invalid", !valid);
    const group = el.closest(".input-group");
    const feedback = group && group.parentElement && group.parentElement.querySelector(".invalid-feedback");
    if (feedback) feedback.classList.toggle("d-block", !valid);
    if (!valid && !firstBad) firstBad = el;
  });
  if (firstBad) firstBad.focus();
  return !firstBad;
}
