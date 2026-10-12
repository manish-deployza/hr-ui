/* Reset-password screen. The emailed link points straight here as
 * reset-password.html?token=... (app.reset.link-base) — no backend hop; the
 * token is only validated when we POST /auth/reset-password {token, newPassword}.
 * 200 -> done, 400 -> bad/expired token or weak password. */

const token = qs("token");
const form = document.getElementById("reset-form");
const errorEl = document.getElementById("reset-error");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirm-password");
const rulesList = document.getElementById("password-rules");

if (!token) {
  form.hidden = true;
  errorEl.textContent = "This reset link is invalid or has expired. Request a new one from the sign-in page.";
  errorEl.hidden = false;
}

// Same live-guidance pattern as signup.js: show only the failing rules.
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
      .resetPassword(token, password.value)
      .then(() => {
        form.hidden = true;
        document.getElementById("reset-success").hidden = false;
        document.getElementById("reset-success-actions").hidden = false;
      })
      .catch((err) => {
        errorEl.textContent = err.message || "Could not reset your password. The link may have expired.";
        errorEl.hidden = false;
      })
  );
});
