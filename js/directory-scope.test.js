const assert = require("assert");
const {
  DIRECTORY_FIELDS,
  DIRECTORY_SENSITIVE_FIELDS,
  DIRECTORY_MASKED_FIELDS,
  maskTail,
  toDirectoryRow,
  resolveDirectoryScope,
  skipLevelManagerId,
  directoryCandidates,
  directoryMatchesFilters,
  directoryPage,
  workAnniversary,
} = require("./directory-scope.js");

const employees = [
  { id: 1, name: "Jordan Lee", managerId: null, role: "EMPLOYEE", department: "Engineering", status: "ACTIVE", basicSalary: 185000, address: "12 Main St", dateOfExit: null },
  { id: 2, name: "Alex Kim", managerId: 1, role: "EMPLOYEE", department: "Engineering", status: "ACTIVE" },
  { id: 3, name: "Priya Sharma", managerId: 1, role: "EMPLOYEE", department: "engineering", status: "ACTIVE" },
  { id: 4, name: "Sam Rivera", managerId: null, role: "HR", department: "People Ops", status: "ACTIVE" },
  { id: 5, name: "Dana Ex", managerId: 1, role: "EMPLOYEE", department: "Engineering", status: "EXITED" },
  { id: 6, name: null, managerId: 4, role: "ORG_ADMIN", department: null, status: "ACTIVE" },
];

/* --- field tiering: the regression guard for the whole two-tier rule --- */
// Sensitive fields ride along ONLY when explicitly asked for, and the flag
// must be "is an ORG_ADMIN", never "is ORG scope" — an HR is ORG scope.
const row = toDirectoryRow(employees[0], false);
const admin = toDirectoryRow(employees[0], true);

assert.deepStrictEqual(Object.keys(row), DIRECTORY_FIELDS, "base row is exactly the P0/P1 allowlist");
assert.strictEqual(toDirectoryRow({ id: 9 }, false).phone, null, "absent field becomes null, not undefined");

// Not on EITHER list: account lifecycle, and the legacy free-text address.
["role", "dateOfExit", "emailVerified", "address"].forEach((f) => {
  assert.strictEqual(f in row, false, f + " must never reach a directory row");
  assert.strictEqual(f in admin, false, f + " must not reach even an admin row");
});

// The whole point: P2-P4 are absent without the flag, present with it.
["basicSalary", "bankAccount", "nationalId", "dateOfBirth", "address1", "personalEmail",
 "emergencyPhone", "maritalStatus", "bloodGroup", "gender"].forEach((f) => {
  assert.strictEqual(f in row, false, f + " must be absent from a non-admin row");
  assert.strictEqual(f in admin, true, f + " must be present for an ORG_ADMIN");
});

// P0/P1 fields are on both.
["workLocation"].forEach((f) => {
  assert.strictEqual(f in row, true, f + " is P0/P1 and belongs on every directory row");
});

// The two lists must not overlap — a field in both would be ambiguous.
const overlap = DIRECTORY_FIELDS.filter((f) => DIRECTORY_SENSITIVE_FIELDS.indexOf(f) !== -1);
assert.deepStrictEqual(overlap, [], "no field may be on both tiers");
assert.deepStrictEqual(
  Object.keys(admin),
  DIRECTORY_FIELDS.concat(DIRECTORY_SENSITIVE_FIELDS),
  "an admin row is exactly both lists, nothing more"
);
// Everything masked must be a sensitive field, or masking is pointless.
DIRECTORY_MASKED_FIELDS.forEach((f) =>
  assert.strictEqual(DIRECTORY_SENSITIVE_FIELDS.indexOf(f) !== -1, true, f + " is masked so it must be sensitive")
);

/* --- masking --- */
assert.strictEqual(maskTail("000000000001234"), "•••• 1234");
assert.strictEqual(maskTail("XXXXX0000A"), "•••• 000A");
assert.strictEqual(maskTail("1234"), "••••", "a value no longer than the tail is fully masked");
assert.strictEqual(maskTail("7"), "••••", "never reveal a short value in full");
assert.strictEqual(maskTail(""), "", "empty stays empty rather than showing dots");
assert.strictEqual(maskTail(null), "", "null stays empty");
assert.strictEqual(maskTail(undefined), "", "undefined stays empty");

/* --- skip-level manager, derived --- */
assert.strictEqual(skipLevelManagerId(employees, 2), null, "manager is top of hierarchy, so no skip-level");
assert.strictEqual(skipLevelManagerId(employees, 6), null, "manager 4 has no manager of their own");
assert.strictEqual(skipLevelManagerId(employees, 1), null, "no manager at all means no skip-level");
assert.strictEqual(skipLevelManagerId(employees, 999), null, "unknown employee returns null, not a throw");
const chain = [
  { id: 10, managerId: 11 },
  { id: 11, managerId: 12 },
  { id: 12, managerId: null },
];
assert.strictEqual(skipLevelManagerId(chain, 10), 12, "two hops up the manager chain");
assert.strictEqual(
  skipLevelManagerId([{ id: 20, managerId: 21 }, { id: 21, managerId: 20 }], 20),
  null,
  "a two-person cycle does not report someone as their own skip-level"
);

/* --- scope resolution, first match wins --- */
assert.strictEqual(resolveDirectoryScope({ id: 6, role: "ORG_ADMIN" }, employees), "ORG");
assert.strictEqual(resolveDirectoryScope({ id: 4, role: "HR" }, employees), "ORG");
assert.strictEqual(resolveDirectoryScope({ id: 1, role: "EMPLOYEE" }, employees), "REPORTS");
assert.strictEqual(resolveDirectoryScope({ id: 2, role: "EMPLOYEE" }, employees), "SELF");
assert.strictEqual(
  resolveDirectoryScope({ id: 4, role: "ORG_ADMIN" }, employees),
  "ORG",
  "an ORG_ADMIN who also has reports gets ORG, not REPORTS"
);
assert.strictEqual(
  resolveDirectoryScope({ id: 2, role: "EMPLOYEE", isManager: true }, employees),
  "SELF",
  "session.isManager is ignored — reports are derived from managerId"
);
assert.strictEqual(resolveDirectoryScope(null, employees), "SELF", "no session fails closed to SELF");

/* --- candidates per scope --- */
assert.deepStrictEqual(directoryCandidates(employees, "ORG", 6).map((e) => e.id), [1, 2, 3, 4, 6], "ORG excludes EXITED");
assert.deepStrictEqual(directoryCandidates(employees, "REPORTS", 1).map((e) => e.id), [2, 3], "REPORTS excludes the EXITED report");
assert.deepStrictEqual(directoryCandidates(employees, "SELF", 2).map((e) => e.id), [2]);
assert.deepStrictEqual(directoryCandidates(employees, "SELF", 5), [], "SELF on an EXITED account is empty, not an error");

/* --- filters, AND-combined --- */
const rows = employees.map(toDirectoryRow);
const ids = (f) => rows.filter((r) => directoryMatchesFilters(r, f)).map((r) => r.id);
assert.deepStrictEqual(ids({}), [1, 2, 3, 4, 5, 6], "no filters matches everything");
assert.deepStrictEqual(ids({ department: "ENGINEERING" }), [1, 2, 3, 5], "department is case-insensitive exact");
assert.deepStrictEqual(ids({ department: "Eng" }), [], "department is exact, not a prefix");
assert.deepStrictEqual(ids({ managerId: 1 }), [2, 3, 5]);
assert.deepStrictEqual(ids({ managerId: "1" }), [2, 3, 5], "a string managerId from a query param still matches");
assert.deepStrictEqual(ids({ search: "ali" }), [], "search misses when no name contains it");
assert.deepStrictEqual(ids({ search: "sam" }), [4], "search is case-insensitive substring");
assert.deepStrictEqual(ids({ managerId: 1, search: "alex" }), [2], "filters combine with AND");
assert.deepStrictEqual(ids({ managerId: 1, search: "sam" }), [], "AND, not OR");
assert.strictEqual(directoryMatchesFilters(rows[5], { search: "a" }), false, "a null name never matches a search");
assert.strictEqual(directoryMatchesFilters(rows[5], { department: "Engineering" }), false, "a null department never matches");

/* --- paging: deterministic order, no repeats across pages --- */
const p0 = directoryPage(rows, 0, 2);
const p1 = directoryPage(rows, 1, 2);
assert.deepStrictEqual(p0.content.map((r) => r.name), ["Alex Kim", "Dana Ex"], "ORDER BY name");
assert.strictEqual(directoryPage(rows, 2, 2).content[1].name, null, "a nameless row sorts last, not first");
assert.strictEqual(p0.totalElements, 6);
assert.strictEqual(p0.totalPages, 3);
assert.strictEqual(p0.content.filter((r) => p1.content.some((q) => q.id === r.id)).length, 0, "pages do not overlap");
assert.deepStrictEqual(directoryPage(rows, 9, 2).content, [], "a page past the end is empty, not an error");
assert.strictEqual(directoryPage(rows, 0, 500).size, 200, "size is clamped to the 200 max");
assert.strictEqual(directoryPage(rows, -3, 0).number, 0, "negative page and zero size fall back to sane values");
assert.strictEqual(directoryPage([], 0, 10).totalPages, 1, "an empty result still reports one page");

/* --- work anniversary: derived, and the branch that actually bites --- */
const jun15 = (y, m, d) => new Date(y, m - 1, d);
assert.strictEqual(workAnniversary("2021-03-15", jun15(2026, 9, 8)), "5 years");
assert.strictEqual(workAnniversary("2021-03-15", jun15(2026, 3, 15)), "5 years", "on the anniversary itself it has counted");
assert.strictEqual(
  workAnniversary("2021-03-15", jun15(2026, 3, 14)),
  "4 years",
  "the day before does not count the year yet"
);
assert.strictEqual(workAnniversary("2025-03-15", jun15(2026, 3, 14)), "First year", "under a year reads as First year");
assert.strictEqual(workAnniversary("2026-03-15", jun15(2026, 9, 8)), "First year");
assert.strictEqual(workAnniversary("2025-09-08", jun15(2026, 9, 8)), "1 year", "singular, not '1 years'");
assert.strictEqual(workAnniversary("2027-01-01", jun15(2026, 9, 8)), "Starts 2027-01-01", "a future start date says so");
assert.strictEqual(workAnniversary("2024-02-29", jun15(2026, 2, 28)), "1 year", "a leap-day start does not skip a year");
assert.strictEqual(workAnniversary(null, jun15(2026, 9, 8)), null);
assert.strictEqual(workAnniversary("", jun15(2026, 9, 8)), null);
assert.strictEqual(workAnniversary("not-a-date", jun15(2026, 9, 8)), null, "junk returns null rather than NaN years");
assert.strictEqual(workAnniversary("2021-03-15T00:00:00Z", jun15(2026, 9, 8)), null, "date-only format only, no silent partial parse");

console.log("directory-scope.js tests passed");
