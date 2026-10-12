document.getElementById("login-onboarded").hidden = !qs("onboarded");

document.getElementById("login-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  const orgWarningEl = document.getElementById("login-org-warning");
  errorEl.hidden = true;
  orgWarningEl.hidden = true;

  const orgKey = document.getElementById("org-key").value.toLowerCase();
  const email = normalizeEmail(document.getElementById("email").value);
  const password = document.getElementById("password").value;

  withSubmitDisabled(
    e.target,
    getCaptchaToken("login")
      .then((captchaToken) => apiClient.login(orgKey, email, password, captchaToken))
      .then(() => apiClient.me())
      .then((session) => {
        // PENDING = set a password but never submitted onboarding; their
        // session only reaches the onboarding form.
        window.location.href = session.status === "PENDING" ? "onboarding.html" : qs("redirect") || "dashboard.html";
      })
      .catch((err) => {
        if (err.status === 404) {
          orgWarningEl.hidden = false;
        } else {
          // INVITED users (no password yet) get the same generic answer by design.
          errorEl.textContent = "Invalid credentials. If you were invited, set your password from the link in your invite email first.";
          errorEl.hidden = false;
        }
      })
  );
});
