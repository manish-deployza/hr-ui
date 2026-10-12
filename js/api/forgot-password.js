/* Forgot-password screen. POST /auth/forgot-password {orgKey, email}.
 * An unknown *email* stays silent (200 {}, no enumeration) — same neutral
 * message as success. An unknown *organization* is already public on the
 * sign-in page (404 there too), so a 404 here shows a plain "not found".
 * The reset link is emailed and lands on reset-password.html?token=...
 * See prompts/features/forgot-password.md. */

// Can't say "email not found" outright — the backend returns 200 either way so
// registered addresses aren't enumerable. This wording still tells the user
// what to do when nothing arrives (wrong org/email, or no account).
const NEUTRAL_MSG =
  "If that organization and email match an account, a reset link is on its way — check your inbox and spam (the link expires in 30 minutes). If nothing arrives, re-check the address or contact your HR admin.";

document.getElementById("fyp-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const note = document.getElementById("fyp-note");
  note.hidden = true;
  const orgKey = document.getElementById("org-key").value.trim().toLowerCase();
  const email = normalizeEmail(document.getElementById("email").value);

  const show = (cls, msg) => {
    note.className = "alert " + cls + " small";
    note.textContent = msg;
    note.hidden = false;
  };

  withSubmitDisabled(
    e.target,
    getCaptchaToken("forgot_password")
      .then((captchaToken) => apiClient.forgotPassword(orgKey, email, captchaToken))
      .then(() => show("alert-info", NEUTRAL_MSG))
      .catch((err) => {
        if (err.status === 404) {
          show("alert-warning", "That organization was not found. Check the name, or create the account.");
        } else {
          show("alert-danger", "Couldn't send the reset link. Please try again.");
        }
      })
  );
});
