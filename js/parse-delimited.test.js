const assert = require("assert");
const { parseDelimited } = require("./parse-delimited.js");

assert.deepStrictEqual(
  parseDelimited("name,email,role\nAlex Kim,alex.kim@example.com,EMPLOYEE\nSam Rivera,sam.rivera@example.com,HR"),
  [
    { name: "Alex Kim", email: "alex.kim@example.com", role: "EMPLOYEE" },
    { name: "Sam Rivera", email: "sam.rivera@example.com", role: "HR" },
  ]
);

assert.deepStrictEqual(
  parseDelimited("name\temail\trole\nPriya Sharma\tpriya.sharma@example.com\tEMPLOYEE"),
  [{ name: "Priya Sharma", email: "priya.sharma@example.com", role: "EMPLOYEE" }]
);

assert.deepStrictEqual(parseDelimited(""), []);
assert.deepStrictEqual(parseDelimited("name,email,role\n"), []);

// Header casing must survive intact — rows pass straight through to the
// backend on some imports (employee import's managerEmail, employeeCode,
// dateOfJoining, ...), so the header IS the JSON field name.
assert.deepStrictEqual(
  parseDelimited("email,role,managerEmail,dateOfJoining\ncarol@acme.test,HR,,2025-01-10"),
  [{ email: "carol@acme.test", role: "HR", managerEmail: "", dateOfJoining: "2025-01-10" }]
);

console.log("parseDelimited: ok");
