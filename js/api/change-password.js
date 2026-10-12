document.getElementById("change-password-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const errorEl = document.getElementById("change-password-error");
  errorEl.hidden = true;

  const currentPassword = document.getElementById("current-password").value;
  const newPassword = document.getElementById("new-password").value;

  apiClient
    .changePassword(currentPassword, newPassword)
    .then(() => (window.location.href = "dashboard.html"))
    .catch((err) => {
      errorEl.textContent = err.message || "Could not update password.";
      errorEl.hidden = false;
    });
});
