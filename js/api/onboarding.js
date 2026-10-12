/* Invited-user onboarding wizard (employee-onboarding.md). Reached with the
 * onboarding-only (PENDING) session that set-password or login establishes;
 * auth-guard.js sends every other PENDING page load here and everyone else
 * away. Steps: Personal details + address, Emergency contact, Pay & IDs, then
 * a Review page (Edit link per section) and Submit. Each step PUTs on its own
 * so closing the tab resumes at GET /onboarding's nextStep. The server
 * re-validates everything; the HTML constraints here are only early feedback. */

const OB_STEPS = ["personal", "emergency", "payIds", "review"];
const OB_STEP_NAMES = { personal: "Personal", emergency: "Emergency contact", payIds: "Pay & IDs", review: "Review" };
const OB_DONE_FLAG = { personal: "personalDone", emergency: "emergencyDone", payIds: "payIdsDone" };
const OB_SAVE = {
  personal: (body) => apiClient.saveOnboardingPersonal(body),
  emergency: (body) => apiClient.saveOnboardingEmergency(body),
  payIds: (body) => apiClient.saveOnboardingPayIds(body),
};

// [heading, editStep, [label, field]...] — the review page, as data.
const OB_REVIEW = [
  ["Personal details", "personal", [["Phone", "phone"], ["Date of birth", "dateOfBirth"], ["Gender", "gender"],
    ["Nationality", "nationality"], ["Marital status", "maritalStatus"], ["Blood group", "bloodGroup"], ["Personal email", "personalEmail"]]],
  ["Address", "personal", [["Address line 1", "address1"], ["Address line 2", "address2"], ["Landmark", "landmark"],
    ["City", "city"], ["State / region", "state"], ["Postal code", "postalCode"], ["Country", "country"]]],
  ["Emergency contact", "emergency", [["Name", "emergencyName"], ["Relationship", "emergencyRelationship"], ["Phone", "emergencyPhone"]]],
  ["Pay & IDs", "payIds", [["Bank account", "bankAccount"], ["IFSC", "bankIfsc"], ["Government ID", "nationalId"], ["Tax ID", "taxId"], ["Passport", "passport"]]],
];

const obForm = document.getElementById("ob-form");
const obError = document.getElementById("ob-error");
let obData = null;
let obStep = "personal";

document.addEventListener("session-ready", function (ev) {
  window.FragmentsReady.then(function () {
    document.getElementById("ob-name").textContent = ev.detail.name ? ", " + ev.detail.name : "";
    OB_STEPS.slice(0, 3).forEach(function (s) {
      obStepEl(s).querySelector(".ob-mount").appendChild(document.querySelector('#ob-fields [data-section="' + s + '"]'));
    });
    initEmpDetailFields(obForm, true);
    apiClient
      .onboarding()
      .then(function (d) {
        obApply(d);
        obShow(OB_STEPS.indexOf(d.nextStep) === -1 ? "review" : d.nextStep);
      })
      .catch(obFail);
  });
});

function obStepEl(name) {
  return obForm.querySelector('.ob-step[data-step="' + name + '"]');
}

function obFail(err) {
  obError.textContent = (err && err.message) || "Something went wrong. Please try again.";
  obError.hidden = false;
  obError.scrollIntoView({ block: "nearest" });
}

function obApply(d) {
  obData = d;
  fillEmpFields(obForm, flattenEmpData(d));
}

// A step is reachable once every step before it is saved — the same order
// the server's nextStep walks, so nobody lands on Review with a hole in it.
function obCanOpen(name) {
  return OB_STEPS.slice(0, OB_STEPS.indexOf(name)).every((s) => obData[OB_DONE_FLAG[s]]);
}

function obShow(name) {
  obStep = name;
  obError.hidden = true;
  OB_STEPS.forEach((s) => (obStepEl(s).hidden = s !== name));
  if (name === "review") obRenderReview();
  obRenderStepper();
  const i = OB_STEPS.indexOf(name);
  document.getElementById("ob-back").hidden = i === 0;
  document.getElementById("ob-next-label").textContent = name === "review" ? "Submit" : "Save & continue";
  document.getElementById("ob-step-live").textContent = "Step " + (i + 1) + " of " + OB_STEPS.length + ": " + OB_STEP_NAMES[name];
  const first = obStepEl(name).querySelector("input, select");
  if (first) first.focus();
}

function obRenderStepper() {
  document.getElementById("ob-stepper").innerHTML = OB_STEPS.map(function (s, i) {
    const current = s === obStep;
    const done = s !== "review" && obData[OB_DONE_FLAG[s]];
    const marker = '<span class="stepper-marker">' + (done && !current ? '<i class="bi bi-check-lg"></i>' : i + 1) + "</span>";
    const inner = marker + '<span class="stepper-label">' + esc(OB_STEP_NAMES[s]) + "</span>";
    return (
      '<li class="stepper-item' + (current ? " is-current" : done ? " is-done" : "") + '"' + (current ? ' aria-current="step"' : "") + ">" +
      (current || !obCanOpen(s) ? inner : '<button type="button" data-ob-step="' + s + '">' + inner + "</button>") +
      "</li>"
    );
  }).join("");
}

function obRenderReview() {
  const flat = flattenEmpData(obData);
  let missing = false;
  const html = OB_REVIEW.map(function (section) {
    const rows = section[2].map(function (spec) {
      const field = spec[1];
      const el = obForm.querySelector('[name="' + field + '"]');
      let value = flat[field];
      if (value && (field === "nationality" || field === "country")) value = countryName(value);
      const isMissing = !value && el && el.hasAttribute("data-req");
      if (isMissing) missing = true;
      return (
        '<dt class="col-5">' + esc(spec[0]) + "</dt>" +
        '<dd class="col-7 text-break">' + (isMissing ? '<span class="text-danger">Missing</span>' : esc(value || "—")) + "</dd>"
      );
    }).join("");
    return (
      '<div class="d-flex align-items-center justify-content-between mt-3 pb-1 border-bottom">' +
      '<h3 class="h6 mb-0">' + esc(section[0]) + "</h3>" +
      '<button type="button" class="btn btn-sm btn-outline-secondary" data-ob-step="' + section[1] + '"><i class="bi bi-pencil"></i> Edit</button>' +
      "</div>" +
      '<dl class="row mt-2 mb-0">' + rows + "</dl>"
    );
  }).join("");
  document.getElementById("ob-review").innerHTML = html;
  document.getElementById("ob-next").disabled = missing;
}

document.addEventListener("click", function (ev) {
  const jump = ev.target.closest("[data-ob-step]");
  if (jump && obData) obShow(jump.getAttribute("data-ob-step"));
});

document.getElementById("ob-back").addEventListener("click", function () {
  obShow(OB_STEPS[OB_STEPS.indexOf(obStep) - 1]);
});

obForm.addEventListener("input", function (ev) {
  if (ev.target.classList.contains("is-invalid") && ev.target.checkValidity()) {
    ev.target.classList.remove("is-invalid");
    const group = ev.target.closest(".input-group");
    const feedback = group && group.parentElement.querySelector(".invalid-feedback");
    if (feedback) feedback.classList.remove("d-block");
  }
});

obForm.addEventListener("submit", function (ev) {
  ev.preventDefault();
  obError.hidden = true;

  if (obStep === "review") {
    withSubmitDisabled(
      obForm,
      apiClient
        .submitOnboarding()
        .then(() => apiClient.logout())
        .then(() => {
          window.location.href = "login.html?onboarded=1"; // submit revoked the session
        })
        .catch(obFail)
    );
    return;
  }

  const stepEl = obStepEl(obStep);
  if (!validateFields(stepEl)) return;
  const saved = obStep;
  withSubmitDisabled(
    obForm,
    OB_SAVE[saved](readEmpFields(stepEl, EMP_DETAIL_STEPS[saved]))
      .then(function (d) {
        obApply(d);
        obShow(OB_STEPS[OB_STEPS.indexOf(saved) + 1]);
      })
      .catch(obFail)
  ).then(function () {
    // withSubmitDisabled re-enables the button on settle; Review may need it off again.
    if (obStep === "review") obRenderReview();
  });
});

document.getElementById("ob-signout").addEventListener("click", function () {
  apiClient.logout().finally(() => (window.location.href = "login.html"));
});
