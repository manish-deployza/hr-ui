/* Create-organization screen. POST /auth/signup (SignupForm: orgKey,
 * email, password, country) through the shared apiClient — the mock layer
 * answers it too (js/mock-data.js). On success the backend sets the session
 * cookie, so we redirect in like login does. See prompts/features/signup.md.
 *
 * country is a required ISO 3166-1 alpha-2 code (AuthFlow.requireCountry) --
 * "sets billing currency and pricing", picked from the same Intl-backed list
 * as the directory's country selects (js/utils.js's countries()). */

const orgKey = document.getElementById("org-key");
const orgKeyWarning = document.getElementById("org-key-warning");
// Mirrors the backend rule (OrganizationService.KEY); warn live + block submit.
const ORG_KEY_RE = /^[a-z0-9_-]{1,64}$/;
orgKey.addEventListener("input", () => {
  orgKey.value = orgKey.value.toLowerCase();
  const bad = orgKey.value && !ORG_KEY_RE.test(orgKey.value);
  const msg = bad ? "1–64 lowercase letters, digits, hyphens, or underscores." : "";
  orgKeyWarning.textContent = msg;
  orgKeyWarning.hidden = !msg;
  orgKey.setCustomValidity(msg);
});

const country = document.getElementById("signup-country");
country.innerHTML =
  '<option value="">Select…</option>' +
  countries().map((c) => '<option value="' + c.code + '">' + esc(c.label) + "</option>").join("");

const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirm-password");
const rulesList = document.getElementById("password-rules");

// Live errors: while typing, list only the rules that currently fail (red);
// nothing shown when the field is empty or all rules pass. Also blocks submit
// via setCustomValidity. Backend re-checks.
const renderPasswordRules = () => {
  const failed = password.value ? passwordChecks(password.value, email.value).filter((c) => !c.ok) : [];
  rulesList.innerHTML = failed
    .map((c) => '<li class="text-danger"><i class="bi bi-x-circle-fill me-1"></i>' + esc(c.label) + "</li>")
    .join("");
  rulesList.hidden = failed.length === 0;
  password.setCustomValidity(failed.length ? failed[0].label : "");
};

const checkPasswordsMatch = () => {
  confirmPassword.setCustomValidity(confirmPassword.value !== password.value ? "Passwords don't match." : "");
};
password.addEventListener("input", () => {
  renderPasswordRules();
  checkPasswordsMatch();
});
confirmPassword.addEventListener("input", checkPasswordsMatch);
email.addEventListener("input", renderPasswordRules);
renderPasswordRules();

document.getElementById("signup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const note = document.getElementById("signup-note");
  note.className = "alert alert-info small mt-2";
  note.hidden = true;

  withSubmitDisabled(
    e.target,
    getCaptchaToken("signup")
      .then((captchaToken) =>
        apiClient.signup(orgKey.value.trim(), normalizeEmail(email.value), password.value, country.value, captchaToken)
      )
      .then(() => {
        window.location.href = "dashboard.html";
      })
      .catch((err) => {
        note.className = "alert alert-danger small mt-2";
        note.textContent = (err && err.body && err.body.summary) || "Could not create your organization. Please try again.";
        note.hidden = false;
      })
  );
});
