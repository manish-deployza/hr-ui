const assert = require("assert");
const { managersOf, directReportsOf, employeeMatchesFilters } = require("./team-roster.js");

const employees = [
  { id: 1, name: "Jordan Lee", email: "jordan.lee@example.com", role: "EMPLOYEE", managerId: null },
  { id: 2, name: "Alex Kim", email: "alex.kim@example.com", role: "EMPLOYEE", managerId: 1 },
  { id: 3, name: "Priya Sharma", email: "priya.sharma@example.com", role: "EMPLOYEE", managerId: 1 },
  { id: 4, name: "Sam Rivera", email: "sam.rivera@example.com", role: "HR_ADMIN", managerId: null },
];

assert.deepStrictEqual(managersOf(employees).map((e) => e.id), [1], "only employees pointed at by someone's managerId count");
assert.deepStrictEqual(directReportsOf(employees, 1).map((e) => e.id), [2, 3]);
assert.deepStrictEqual(directReportsOf(employees, 4), [], "manager with no reports returns empty");
assert.deepStrictEqual(directReportsOf(employees, 999), [], "unknown manager id returns empty");

assert.strictEqual(employeeMatchesFilters(employees[1], {}), true, "no filters matches everything");
assert.strictEqual(employeeMatchesFilters(employees[1], { managerId: 1 }), true);
assert.strictEqual(employeeMatchesFilters(employees[1], { managerId: 4 }), false);
assert.strictEqual(employeeMatchesFilters(employees[0], { managerId: "NONE" }), true, "top-of-hierarchy filter matches null managerId");
assert.strictEqual(employeeMatchesFilters(employees[1], { managerId: "NONE" }), false);
assert.strictEqual(employeeMatchesFilters(employees[1], { search: "alex" }), true, "case-insensitive name match");
assert.strictEqual(employeeMatchesFilters(employees[1], { search: "priya" }), false);
assert.strictEqual(employeeMatchesFilters(employees[1], { managerId: 1, search: "alex" }), true, "manager and search combine with AND");
assert.strictEqual(employeeMatchesFilters(employees[1], { managerId: 1, search: "priya" }), false);

console.log("team-roster: ok");
