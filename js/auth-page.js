// Shared behavior for login.html / signup.html / forgot-password.html —
// show/hide toggle for any .signin-toggle-password button.
document.querySelectorAll(".signin-toggle-password").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    const icon = btn.querySelector("i");
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    icon.className = showing ? "bi bi-eye" : "bi bi-eye-slash";
    btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });
});
