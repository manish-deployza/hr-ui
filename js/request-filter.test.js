const assert = require("assert");
const { requestMatchesFilters } = require("./request-filter.js");

const request = {
  employeeName: "Alex Kim",
  leaveTypeName: "Casual Leave",
  status: "APPROVED",
  startDate: "2026-07-10",
  endDate: "2026-07-12",
};

assert.strictEqual(requestMatchesFilters(request, {}), true, "no filters matches everything");
assert.strictEqual(requestMatchesFilters(request, { employee: "alex" }), true, "case-insensitive partial employee match");
assert.strictEqual(requestMatchesFilters(request, { employee: "priya" }), false, "non-matching employee excluded");
assert.strictEqual(requestMatchesFilters(request, { leaveType: "Casual Leave" }), true);
assert.strictEqual(requestMatchesFilters(request, { leaveType: "Privilege Leave" }), false);
assert.strictEqual(requestMatchesFilters(request, { status: "APPROVED" }), true);
assert.strictEqual(requestMatchesFilters(request, { status: "REJECTED" }), false);
assert.strictEqual(requestMatchesFilters(request, { dateFrom: "2026-07-01", dateTo: "2026-07-31" }), true, "range containing the request");
assert.strictEqual(requestMatchesFilters(request, { dateFrom: "2026-08-01" }), false, "request ends before range starts");
assert.strictEqual(requestMatchesFilters(request, { dateTo: "2026-07-01" }), false, "request starts after range ends");
assert.strictEqual(requestMatchesFilters(request, { dateFrom: "2026-07-11", dateTo: "2026-07-11" }), true, "range inside the request's span");

console.log("requestMatchesFilters: ok");
