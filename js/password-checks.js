/* Password policy — mirrors the backend's signup / change-password rules so the
 * form can guide the user while typing; the backend still re-checks. Returns a
 * list [{label, ok}]: the form gates submit on every check passing and renders
 * the list as live tick/cross guidance. No composition rules (forced
 * upper/digit/symbol) and no expiry, by design.
 *
 * ponytail: the "repeated sequence" test only catches a repeated 1-3 char unit
 * (aaaaaaaa, abababab, abcabcabc); swap for a real entropy estimate if that
 * proves too weak. */
function passwordChecks(pwd, email) {
  pwd = pwd || "";
  const local = (email || "").split("@")[0].toLowerCase();
  return [
    { label: "At least 8 characters", ok: pwd.length >= 8 },
    { label: "Not a repeated sequence", ok: !/^(.{1,3})\1+$/.test(pwd) },
    {
      label: "Doesn't contain your email name",
      ok: local.length < 3 || !pwd.toLowerCase().includes(local),
    },
  ];
}

function passwordIsValid(pwd, email) {
  return passwordChecks(pwd, email).every((c) => c.ok);
}

if (typeof module !== "undefined") module.exports = { passwordChecks, passwordIsValid };
