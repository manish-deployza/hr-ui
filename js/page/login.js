document.getElementById("login-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  errorEl.hidden = true;

  const email = normalizeEmail(document.getElementById("email").value);
  const password = document.getElementById("password").value;

  apiClient
    .login(email, password)
    .then(() => apiClient.me())
    .then((session) => {
      if (session.forcePasswordReset) {
        window.location.href = "/change-password.html";
        return;
      }
      window.location.href = qs("redirect") || "/dashboard.html";
    })
    .catch(() => {
      errorEl.textContent = "Invalid credentials.";
      errorEl.hidden = false;
    });
});
