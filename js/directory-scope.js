/* Directory read-scope, field-tiering and paging rules — the P0/P1 boundary
 * from prompts/features/employee-directory.md. Pure functions, no DOM, so
 * the mock layer (js/mock-data.js), the page script (js/api/directory.js)
 * and node (directory-scope.test.js) all run the same rules. */

/* Two tiers, and the split is the access control.
 *
 * DIRECTORY_FIELDS is P0/P1 — safe for anyone who can see the row at all,
 * including a manager looking at a direct report and an employee looking at
 * themselves.
 *
 * DIRECTORY_SENSITIVE_FIELDS is P2-P4 — date of birth, home address,
 * personal contact, pay, bank, government IDs, and the voluntary
 * health/EEO/union answers. These are returned ONLY to an ORG_ADMIN, which
 * is a stricter test than ORG *scope*: an HR also resolves to ORG
 * scope and must not get them. Gating on scope instead of role here would
 * hand HR every employee's bank details.
 *
 * `role` and `dateOfExit` are on neither list — they are account lifecycle
 * and belong to the HR screen. */
const DIRECTORY_FIELDS = [
  "id",
  "employeeCode",
  "name",
  "email",
  "phone",
  "department",
  "designation",
  "employeeType",
  "status",
  "dateOfJoining",
  "managerId",
  "workLocation",
];

const DIRECTORY_SENSITIVE_FIELDS = [
  // Personal (P2)
  "dateOfBirth",
  "gender",
  "nationality",
  "maritalStatus",
  "bloodGroup",
  "personalEmail",
  // Structured home address (P2) — seven columns, never one free-text blob.
  "address1",
  "address2",
  "city",
  "landmark",
  "postalCode",
  "state",
  "country",
  // Emergency contact (P2) — all three or none.
  "emergencyName",
  "emergencyRelationship",
  "emergencyPhone",
  // Compensation and banking (P3)
  "basicSalary",
  "bankAccount",
  "bankIfsc",
  // Government IDs (P3/P4)
  "nationalId",
  "taxId",
  "passport",
];

// Fields shown masked to their last 4 characters even to an ORG_ADMIN. A
// real reveal is a separate, audited endpoint (spec Phase 4) — this only
// stops a shoulder-surfer reading a full account number off the screen.
const DIRECTORY_MASKED_FIELDS = ["bankAccount", "nationalId", "taxId", "passport"];

function maskTail(value) {
  const s = value == null ? "" : String(value);
  if (s.length <= 4) return s ? "••••" : "";
  return "•••• " + s.slice(-4);
}

/* Projects an employee onto the allowlist. `includeSensitive` must be the
 * answer to "is this caller an ORG_ADMIN", not "is this caller ORG scope". */
function toDirectoryRow(employee, includeSensitive) {
  const row = {};
  DIRECTORY_FIELDS.forEach((f) => (row[f] = employee[f] === undefined ? null : employee[f]));
  if (includeSensitive) {
    DIRECTORY_SENSITIVE_FIELDS.forEach((f) => (row[f] = employee[f] === undefined ? null : employee[f]));
  }
  return row;
}

/* First match wins: an ORG_ADMIN who also has direct reports gets ORG, not
 * REPORTS. "Manager" is derived from employee.managerId (same rule as
 * team-roster.js / the backend's existsManager), never a stored role — and
 * deliberately not from session.isManager, which the mock hardcodes true. */
function resolveDirectoryScope(session, employees) {
  if (!session) return "SELF";
  if (session.role === "ORG_ADMIN" || session.role === "HR") return "ORG";
  return (employees || []).some((e) => e.managerId === session.id) ? "REPORTS" : "SELF";
}

// EXITED rows are dropped in every scope, including SELF.
function directoryCandidates(employees, scope, viewerId) {
  const rows =
    scope === "ORG"
      ? employees
      : scope === "REPORTS"
        ? employees.filter((e) => e.managerId === viewerId)
        : employees.filter((e) => e.id === viewerId);
  return rows.filter((e) => e.status !== "EXITED");
}

/* The manager's manager, one more hop up employee.managerId — derived, so
 * there is no skip_level_manager_id column to drift out of sync. Returns
 * null when the chain runs out, and also when it loops straight back to the
 * employee (a two-person cycle): "your own skip-level is yourself" is worse
 * than showing nothing. A longer cycle is the server's problem. */
function skipLevelManagerId(employees, employeeId) {
  const self = employees.find((e) => e.id === employeeId);
  if (!self || self.managerId == null) return null;
  const manager = employees.find((e) => e.id === self.managerId);
  if (!manager || manager.managerId == null) return null;
  return manager.managerId === employeeId ? null : manager.managerId;
}

/* AND-combined. department is case-insensitive exact (a null department
 * never matches); search is a case-insensitive substring on name, and a null
 * name never matches — createOrgAdminProfile really does leave it null. */
function directoryMatchesFilters(row, filters) {
  filters = filters || {};
  if (filters.department) {
    if (!row.department) return false;
    if (row.department.toLowerCase() !== String(filters.department).toLowerCase()) return false;
  }
  if (filters.managerId !== undefined && filters.managerId !== null && filters.managerId !== "") {
    if (row.managerId !== Number(filters.managerId)) return false;
  }
  if (filters.search) {
    if (!row.name) return false;
    if (row.name.toLowerCase().indexOf(String(filters.search).toLowerCase()) === -1) return false;
  }
  return true;
}

// ORDER BY name, id — deterministic, so page 2 can't repeat a row page 1
// already showed. Shaped like a Spring Page so the real endpoint can drop in.
// Nameless rows sort last, not first: an empty string would otherwise put
// the least useful row at the top of page 1.
function directoryPage(rows, page, size) {
  size = Math.min(Math.max(Number(size) || 50, 1), 200);
  page = Math.max(Number(page) || 0, 0);
  const sorted = rows
    .slice()
    .sort(
      (a, b) =>
        !a.name - !b.name || String(a.name || "").localeCompare(String(b.name || "")) || a.id - b.id
    );
  const from = page * size;
  return {
    content: sorted.slice(from, from + size),
    totalElements: sorted.length,
    totalPages: Math.max(1, Math.ceil(sorted.length / size)),
    number: page,
    size: size,
  };
}

/* Completed years of service, derived from dateOfJoining — there is no
 * anniversary column and there shouldn't be one. `today` is a parameter, not
 * a new Date() inside, so the before/after-anniversary branches are testable
 * without mocking the clock. Returns a label, or null when there's nothing
 * to say. Dates are built from local y/m/d parts for the same reason
 * formatDate() does it: "YYYY-MM-DD" parses as UTC midnight and would shift
 * a day backwards west of UTC. */
function workAnniversary(dateOfJoining, today) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfJoining || "");
  if (!parts) return null;
  const start = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  if (isNaN(start.getTime())) return null;
  const now = today || new Date();
  let years = now.getFullYear() - start.getFullYear();
  const beforeAnniversary =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
  if (beforeAnniversary) years--;
  if (years < 0) return "Starts " + dateOfJoining;
  return years === 0 ? "First year" : years + " year" + (years === 1 ? "" : "s");
}

if (typeof module !== "undefined") {
  module.exports = {
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
  };
}
