const assert = require("assert");
const { matchesFilter } = require("./list-filter.js");

assert.strictEqual(matchesFilter("Alex Kim  Casual Leave  Approved", ""), true);
assert.strictEqual(matchesFilter("Alex Kim  Casual Leave  Approved", "alex"), true);
assert.strictEqual(matchesFilter("Alex Kim  Casual Leave  Approved", "CASUAL"), true);
assert.strictEqual(matchesFilter("Alex Kim  Casual Leave  Approved", "priya"), false);

console.log("matchesFilter: ok");
