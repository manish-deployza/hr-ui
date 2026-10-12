/* Invite-link landing page. The emailed link points straight here as
 * set-password.html?token=... — no backend hop, no session, no auth-guard.js.
 * POST /auth/set-password consumes the single-use token (INVITED -> PENDING),
 * sets the password, and sets an onboarding-only session cookie, so the very
 * next page is the onboarding form. */

const token = qs("token");
const form = document.getElementById("set-password-form");
const errorEl = document.getElementById("set-password-error");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirm-password");
const rulesList = document.getElementById("password-rules");

if (!token) {
  form.hidden = true;
  errorEl.textContent = "This invite link is invalid or has expired. Ask your organization admin to resend the invite.";
  errorEl.hidden = false;
}

// Same live-guidance pattern as signup.js/reset-password.js: show only the
// failing rules. No email is known here (unauthenticated, token-only), so
// the "doesn't contain your email name" check trivially passes.
const renderPasswordRules = () => {
  const failed = password.value ? passwordChecks(password.value).filter((c) => !c.ok) : [];
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

form.addEventListener("submit", (e) => {
  e.preventDefault();
  errorEl.hidden = true;

  withSubmitDisabled(
    form,
    apiClient
      .setPassword(token, password.value)
      .then(() => {
        window.location.href = "onboarding.html";
      })
      .catch((err) => {
        errorEl.textContent = err.message || "Could not set your password. The link may have expired or already been used.";
        errorEl.hidden = false;
      })
  );
});
