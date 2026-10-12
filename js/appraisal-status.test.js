const assert = require("assert");
const { isTerminalAppraisalStatus, canCancelAppraisal, canReopenAppraisal, calibrationNeedsReason } = require("./appraisal-status.js");

assert.strictEqual(isTerminalAppraisalStatus("CLOSED"), true);
assert.strictEqual(isTerminalAppraisalStatus("CANCELLED"), true);
assert.strictEqual(isTerminalAppraisalStatus("FINALIZED"), false, "finalized can still be reopened - not terminal");
assert.strictEqual(isTerminalAppraisalStatus("SELF_APPRAISAL"), false);

assert.strictEqual(canCancelAppraisal("HR_REVIEW"), true);
assert.strictEqual(canCancelAppraisal("RETURNED"), true);
assert.strictEqual(canCancelAppraisal("FINALIZED"), false, "a finalized review shouldn't be cancelled");
assert.strictEqual(canCancelAppraisal("CLOSED"), false);

assert.strictEqual(canReopenAppraisal("FINALIZED"), true);
assert.strictEqual(canReopenAppraisal("ACKNOWLEDGED"), true);
assert.strictEqual(canReopenAppraisal("CLOSED"), true);
assert.strictEqual(canReopenAppraisal("HR_REVIEW"), false, "still in flight - nothing to reopen");

assert.strictEqual(calibrationNeedsReason(4.2, 4.2), false, "unchanged score needs no reason");
assert.strictEqual(calibrationNeedsReason(4.2, 4.20001), false, "float noise within epsilon needs no reason");
assert.strictEqual(calibrationNeedsReason(4.2, 3.9), true, "a real change needs a reason");
assert.strictEqual(calibrationNeedsReason(null, 4.0), false, "no manager score yet -> nothing to compare");
assert.strictEqual(calibrationNeedsReason(4.2, null), false, "no calibrated score entered yet -> nothing to compare");

console.log("appraisal-status: ok");
