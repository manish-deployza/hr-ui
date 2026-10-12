const assert = require("assert");
const {
  DIR_POSTAL_REQUIRED,
  DIR_STATE_REQUIRED,
  DIR_LANDMARK_COUNTRIES,
  addressRequiredness,
  emergencyRequiredness,
  shouldHideLandmark,
} = require("./directory-profile-rules.js");

/* --- address all-or-nothing --- */
assert.deepStrictEqual(
  addressRequiredness({}),
  { address1: false, city: false, country: false, postalCode: false, state: false },
  "a fully blank address requires nothing"
);
assert.strictEqual(addressRequiredness({ city: "Bengaluru" }).address1, true, "touching one address field requires the rest");
assert.strictEqual(addressRequiredness({ city: "Bengaluru" }).country, true, "touching one address field requires country too");

// Postal/state required only for the listed countries, and only once touched.
assert.strictEqual(addressRequiredness({ country: "US" }).postalCode, false, "country alone with nothing else filled requires nothing");
assert.strictEqual(addressRequiredness({ country: "US", address1: "1 Main St" }).postalCode, true, "US requires postal code once touched");
assert.strictEqual(addressRequiredness({ country: "US", address1: "1 Main St" }).state, true, "US requires state once touched");
assert.strictEqual(addressRequiredness({ country: "FR", address1: "1 Main St" }).postalCode, false, "FR is not in the postal-required list");
assert.strictEqual(addressRequiredness({ country: "FR", address1: "1 Main St" }).state, false, "FR is not in the state-required list");

DIR_POSTAL_REQUIRED.forEach((code) =>
  assert.strictEqual(addressRequiredness({ country: code, city: "x" }).postalCode, true, code + " must require postal code once touched")
);
DIR_STATE_REQUIRED.forEach((code) =>
  assert.strictEqual(addressRequiredness({ country: code, city: "x" }).state, true, code + " must require state once touched")
);

/* --- emergency contact all-or-nothing --- */
assert.deepStrictEqual(
  emergencyRequiredness({}),
  { emergencyName: false, emergencyRelationship: false, emergencyPhone: false },
  "no emergency contact info given requires nothing"
);
assert.strictEqual(emergencyRequiredness({ emergencyName: "Jo" }).emergencyPhone, true, "typing one emergency field requires the other two");
assert.strictEqual(emergencyRequiredness({ emergencyPhone: "555-1234" }).emergencyName, true, "typing just the phone still requires the name");

/* --- landmark visibility --- */
DIR_LANDMARK_COUNTRIES.forEach((code) =>
  assert.strictEqual(shouldHideLandmark({ country: code }), false, code + " is a landmark country, so the field must stay shown")
);
assert.strictEqual(shouldHideLandmark({ country: "FR" }), true, "landmark hidden for a non-landmark country with nothing typed");
assert.strictEqual(shouldHideLandmark({ country: "FR", landmark: "Near the bakery" }), false, "an already-typed landmark is never hidden");
assert.strictEqual(shouldHideLandmark({ country: "" }), false, "no country selected yet keeps the field visible");

console.log("directory-profile-rules.test.js: all assertions passed");
