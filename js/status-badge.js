/* Maps a leave_request.status value to a consistent badge — color paired
 * with text, never color alone (accessibility rule, discussion.md #4/#7). */

const STATUS_BADGE_MAP = {
  APPLIED: { variant: "pending", label: "Applied" },
  PENDING_MANAGER: { variant: "pending", label: "Pending manager" },
  PENDING_HR: { variant: "pending", label: "Pending HR" },
  APPROVED: { variant: "approved", label: "Approved" },
  REJECTED: { variant: "rejected", label: "Rejected" },
  CANCELLED: { variant: "neutral", label: "Cancelled" },
  LAPSED: { variant: "neutral", label: "Lapsed" },
};

const ONE_ON_ONE_STATUS_BADGE_MAP = {
  SCHEDULED: { variant: "pending", label: "Scheduled" },
  COMPLETED: { variant: "approved", label: "Completed" },
  CANCELLED: { variant: "neutral", label: "Cancelled" },
};

// Per js/appraisal-status.js / 18-appraisal-enterprise-expansion.md's
// Appraisal state machine. SELF_SUBMITTED and MANAGER_SUBMITTED from the
// source spec are modeled as instantaneous in this app (no separate
// "manager started reviewing" step distinct from opening the page) - see
// mock-data.js's self-review/manager-review handlers - so they never appear
// as a stored status and aren't listed here.
const APPRAISAL_STATUS_BADGE_MAP = {
  SELF_APPRAISAL: { variant: "pending", label: "Self-appraisal" },
  MANAGER_REVIEW: { variant: "pending", label: "Manager review" },
  HR_REVIEW: { variant: "pending", label: "HR review" },
  CALIBRATION: { variant: "pending", label: "Calibration" },
  FINALIZED: { variant: "approved", label: "Finalized" },
  ACKNOWLEDGED: { variant: "approved", label: "Acknowledged" },
  CLOSED: { variant: "approved", label: "Closed" },
  RETURNED: { variant: "rejected", label: "Returned to manager" },
  REOPENED: { variant: "pending", label: "Reopened" },
  CANCELLED: { variant: "neutral", label: "Cancelled" },
};

const APPRAISAL_GOAL_STATUS_BADGE_MAP = {
  NOT_STARTED: { variant: "neutral", label: "Not started" },
  IN_PROGRESS: { variant: "pending", label: "In progress" },
  ACHIEVED: { variant: "approved", label: "Achieved" },
  MISSED: { variant: "rejected", label: "Missed" },
};

const APPRAISAL_CYCLE_STATUS_BADGE_MAP = {
  DRAFT: { variant: "neutral", label: "Draft" },
  OPEN: { variant: "pending", label: "Open" },
  CLOSED: { variant: "approved", label: "Closed" },
};

const ACTION_ITEM_STATUS_BADGE_MAP = {
  OPEN: { variant: "pending", label: "Open" },
  DONE: { variant: "approved", label: "Done" },
  CANCELLED: { variant: "neutral", label: "Cancelled" },
};

function renderBadge(status, map) {
  // Falls back for any status value the map hasn't caught up to yet (new
  // backend enum, typo, null) — prettify rather than showing the raw enum.
  const fallbackLabel = status
    ? String(status).charAt(0) + String(status).slice(1).toLowerCase().replace(/_/g, " ")
    : "Unknown";
  const entry = map[status] || { variant: "neutral", label: fallbackLabel };
  return '<span class="status-badge status-badge--' + entry.variant + '">' + esc(entry.label) + "</span>";
}

// user.status (employee-onboarding.md lifecycle).
const EMPLOYEE_STATUS_BADGE_MAP = {
  INVITED: { variant: "neutral", label: "Invited" },
  PENDING: { variant: "pending", label: "Pending" },
  ONBOARDED: { variant: "pending", label: "Onboarded" },
  ACTIVE: { variant: "approved", label: "Active" },
  ON_NOTICE: { variant: "pending", label: "On notice" },
  EXITED: { variant: "rejected", label: "Exited" },
};

function renderEmployeeStatusBadge(status) {
  return renderBadge(status, EMPLOYEE_STATUS_BADGE_MAP);
}

function renderStatusBadge(status) {
  return renderBadge(status, STATUS_BADGE_MAP);
}
