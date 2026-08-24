const assert = require("assert");
const { parseDelimited } = require("./parse-delimited.js");

assert.deepStrictEqual(
  parseDelimited("name,email,role\nAlex Kim,alex.kim@example.com,EMPLOYEE\nSam Rivera,sam.rivera@example.com,HR_ADMIN"),
  [
    { name: "Alex Kim", email: "alex.kim@example.com", role: "EMPLOYEE" },
    { name: "Sam Rivera", email: "sam.rivera@example.com", role: "HR_ADMIN" },
  ]
);

assert.deepStrictEqual(
  parseDelimited("name\temail\trole\nPriya Sharma\tpriya.sharma@example.com\tEMPLOYEE"),
  [{ name: "Priya Sharma", email: "priya.sharma@example.com", role: "EMPLOYEE" }]
);

assert.deepStrictEqual(parseDelimited(""), []);
assert.deepStrictEqual(parseDelimited("name,email,role\n"), []);

console.log("parseDelimited: ok");
