/* Maps a leave_request.status value to a consistent badge — color paired
 * with text, never color alone (accessibility rule, discussion.md #4/#7). */

const STATUS_BADGE_MAP = {
  APPLIED: { variant: "pending", label: "Applied" },
  PENDING_MANAGER: { variant: "pending", label: "Pending manager" },
  PENDING_HR_ADMIN: { variant: "pending", label: "Pending HR" },
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

const APPRAISAL_STATUS_BADGE_MAP = {
  NOT_STARTED: { variant: "neutral", label: "Not started" },
  SELF_PENDING: { variant: "pending", label: "Self-review pending" },
  MANAGER_PENDING: { variant: "pending", label: "Manager review pending" },
  FINALIZED: { variant: "approved", label: "Finalized" },
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

function renderStatusBadge(status) {
  return renderBadge(status, STATUS_BADGE_MAP);
}
