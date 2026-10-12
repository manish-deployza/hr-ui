const assert = require("assert");
const { passwordChecks, passwordIsValid } = require("./password-checks.js");

const failing = (pwd, email) =>
  passwordChecks(pwd, email).filter((c) => !c.ok).map((c) => c.label);

// happy path
assert.deepStrictEqual(failing("river-stone-42", "alex@example.com"), []);
assert.strictEqual(passwordIsValid("river-stone-42", "alex@example.com"), true);

// too short
assert.deepStrictEqual(failing("ab12cd", "alex@example.com"), ["At least 8 characters"]);

// repetitive strings
assert.ok(failing("aaaaaaaa", "x@y.com").includes("Not a repeated sequence"));
assert.ok(failing("abababab", "x@y.com").includes("Not a repeated sequence"));
assert.ok(failing("abcabcabcabc", "x@y.com").includes("Not a repeated sequence"));

// contains email local-part (>=3 chars); short local-parts are ignored
assert.ok(failing("alexjones99", "alex@example.com").includes("Doesn't contain your email name"));
assert.deepStrictEqual(failing("ab-quiet-river", "ab@example.com"), []);

console.log("passwordChecks: ok");
