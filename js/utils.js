/* Shared helpers, no API calls here — see discussion.md #8. */

/** Escape a string before interpolating it into innerHTML. Server-derived
 * text (reason, hr_notes, employee names, ...) must always go through this;
 * plain-text-only cases should use textContent instead. */
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  // Date-only strings ("YYYY-MM-DD") parse as UTC midnight in JS; building
  // the Date from local y/m/d instead avoids the day shifting backwards for
  // users west of UTC.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(isoDateTime) {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (isNaN(d.getTime())) return isoDateTime;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Local-time "YYYY-MM-DD", matching the date-only strings leave requests
// store — not toISOString(), which is UTC and can land on the wrong day.
function todayIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
}

function normalizeText(value) {
  return (value || "").trim();
}
