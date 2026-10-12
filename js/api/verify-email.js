/* Email-verification result page. The mailed link points at the BACKEND
 * (app.verify.link-base); the backend checks the token, then redirects here
 * with ?verified=1 (ok) or ?verified=0 (bad/expired). This page only reflects
 * that flag -- no API call, so no cross-origin hop from the mail client. */

const verified = qs("verified") === "1";
document.getElementById("verify-pending").hidden = true;
document.getElementById(verified ? "verify-success" : "verify-error").hidden = false;
