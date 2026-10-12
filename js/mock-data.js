/* Mock request router - backs apiFetch() (js/utils.js) when
 * AppConfig.mockMode is true. Loads fixtures from data/*.json once, then
 * answers requests by matching (method, path) against a small route table,
 * replicating the same computed views (team rosters, LOP watchlist, etc.)
 * the old js/api/api-client-mock.js built in memory - just sourced from
 * fetched JSON instead of inline literals. See mock-data.md and
 * file-organization.md Data File Organization.
 *
 * Mutations persist to sessionStorage (STORAGE_KEY below) so a submitted
 * self-review, a new cycle, etc. survive a reload/navigation within the same
 * tab - close the tab (or open a new one) and it resets to the original
 * fixtures. All counters live as plain numbers on `db` (not closures) so the
 * whole object is JSON-safe to persist. */

const STORAGE_KEY = "mockDb";

function loadPersistedDb() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function persistDb(db) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    // storage full or unavailable (e.g. private browsing) - mutations just won't survive a reload
  }
}

function maxId(list) {
  return list.length ? Math.max.apply(null, list.map((x) => x.id)) : 0;
}

// Built lazily on the first mockFetch call (which apiFetch only makes when
// AppConfig.mockMode is true) so real-mode pages never fetch the fixtures.
let _dataReady = null;
function dataReady() {
  if (_dataReady) return _dataReady;
  _dataReady = buildDb();
  return _dataReady;
}

function buildDb() {
  const files = {
    employees: "data/ref-employees.json",
    leaveTypesCatalog: "data/ref-leave-types.json",
    balancesByEmployee: "data/leave-balances-by-employee.json",
    leaveRequests: "data/leave-requests-list.json",
    holidays: "data/holidays-list.json",
    notifications: "data/notifications-list.json",
    oneOnOneSessions: "data/one-on-ones-list.json",
    oneOnOneDetail: "data/one-on-ones-detail.json",
    appraisalRatingValues: "data/appraisal-rating-values.json",
    appraisalCycles: "data/appraisal-cycles.json",
    appraisals: "data/appraisals-list.json",
    performanceLevels: "data/appraisal-performance-levels.json",
    auditLog: "data/audit-log-list.json",
  };
  const keys = Object.keys(files);

  const persisted = loadPersistedDb();
  if (persisted) {
    const mockRole = new URLSearchParams(location.search).get("role");
    if (mockRole) persisted.employees[0].role = mockRole;
    return Promise.resolve(persisted);
  }

  return Promise.all(keys.map((k) => fetch(files[k]).then((r) => r.json()))).then((results) => {
    const db = {};
    keys.forEach((k, i) => (db[k] = results[i]));

    // Mock signed-in user is the org admin by default (they own the settings
  // screen). Override with ?role=EMPLOYEE / ?role=HR to test others.
  db.employees[0].role = new URLSearchParams(location.search).get("role") || "ORG_ADMIN";

    db._nextAppraisalId = maxId(db.appraisals) + 1;
    db._nextCycleId = maxId(db.appraisalCycles) + 1;
    db._nextRatingValueId = maxId(db.appraisalRatingValues) + 1;
    db._nextGoalId = Math.max.apply(null, [0].concat(db.appraisals.reduce((ids, a) => ids.concat((a.goals || []).map((g) => g.id)), []))) + 1;

    persistDb(db);
    return db;
  });
}

const delay = (data) => new Promise((resolve) => setTimeout(() => resolve(data), 150));
const ok = (body) => delay({ ok: true, status: 200, body: body === undefined ? { ok: true } : body });
const notFound = (message) => delay({ ok: false, status: 404, body: { summary: message || "Not found." } });
const badRequest = (message) => delay({ ok: false, status: 400, body: { summary: message || "Bad request." } });
const forbidden = (message) => delay({ ok: false, status: 403, body: { summary: message || "You do not have permission to do that." } });
// Directory fields that travel as numbers, not trimmed strings — passing one
// to normalizeText() throws, since a number has no .trim().
const DIRECTORY_NUMERIC = ["basicSalary"];
function directoryValue(field, raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  if (DIRECTORY_NUMERIC.indexOf(field) !== -1) {
    const n = Number(raw);
    return isNaN(n) ? null : n;
  }
  return normalizeText(String(raw)) || null;
}

const conflict = (message) => delay({ ok: false, status: 409, body: { summary: message || "That conflicts with an existing record." } });

function toSummaryRow(r) {
  return { id: r.id, employeeName: r.employeeName, leaveTypeName: r.leaveTypeName, startDate: r.startDate, endDate: r.endDate, status: r.status };
}
function ratingLabelFor(db, ratingValueId) {
  return (db.appraisalRatingValues.find((r) => r.id === ratingValueId) || {}).label || null;
}
function cycleForAppraisal(db, a) {
  return db.appraisalCycles.find((c) => c.id === a.cycleId);
}
// The manager's weighted category score (0-90% depending on configured
// weights) plus the existing single "manager overall rating" value at its
// reserved 10% - see 18-appraisal-enterprise-expansion.md's Final appraisal
// calculation. Kept out of eval-categories.js since it also needs the
// rating-value lookup, which is mock-layer/db-shaped.
function managerScoreFor(db, a) {
  const categoryPart = weightedCategoryScore(a.managerCategories || []);
  if (categoryPart == null) return null;
  const overallValue = (db.appraisalRatingValues.find((r) => r.id === a.managerRatingValueId) || {}).value;
  return overallValue == null ? categoryPart : categoryPart + overallValue * 0.1;
}
function selfScoreFor(a) {
  return weightedCategoryScore(a.selfCategories || []);
}
// The effective score everywhere else (roster, badges, performance level)
// reads: HR's calibrated number once set (see the /calibrate route below),
// otherwise the manager's computed score.
function finalScoreFor(db, a) {
  return a.calibratedScore != null ? a.calibratedScore : managerScoreFor(db, a);
}
function toAppraisalDetail(db, a) {
  const cycle = cycleForAppraisal(db, a);
  return Object.assign({}, a, {
    cycleName: cycle ? cycle.name : "-",
    cycleCategories: cycle ? cycle.categories : [],
    ratingValues: db.appraisalRatingValues,
    performanceLevels: db.performanceLevels,
    selfScore: selfScoreFor(a),
    managerScore: managerScoreFor(db, a),
    finalScore: finalScoreFor(db, a),
  });
}
function toMyAppraisalRow(db, a) {
  const cycle = cycleForAppraisal(db, a);
  return { id: a.id, cycleName: cycle ? cycle.name : "-", status: a.status, selfRatingLabel: ratingLabelFor(db, a.selfRatingValueId), managerRatingLabel: ratingLabelFor(db, a.managerRatingValueId) };
}
function toTeamAppraisalRow(db, a) {
  const cycle = cycleForAppraisal(db, a);
  return { id: a.id, managerId: a.managerId, employeeId: a.employeeId, employeeName: a.employeeName, cycleName: cycle ? cycle.name : "-", status: a.status };
}
function toHrRosterRow(db, a) {
  const finalScore = finalScoreFor(db, a);
  const level = performanceLevelFor(finalScore, db.performanceLevels);
  return {
    id: a.id,
    employeeName: a.employeeName,
    department: a.snapshot ? a.snapshot.department : null,
    managerName: a.snapshot ? a.snapshot.managerName : null,
    status: a.status,
    selfRatingLabel: ratingLabelFor(db, a.selfRatingValueId),
    managerRatingLabel: ratingLabelFor(db, a.managerRatingValueId),
    finalScore: finalScore,
    performanceLevel: level ? level.label : null,
  };
}

function employeeLeaveTypes(db) {
  return db.leaveTypesCatalog.filter((t) => t.code !== "INTERN_STUDY" && t.code !== "PUBLIC_HOLIDAY");
}

// The single org row. Lazily seeded (no data/*.json for it) and mutated in
// place by PATCH /organization, so edits persist to sessionStorage like any
// other mock mutation and a reload shows the new name/email everywhere.
function orgRow(db) {
  if (!db.organization) {
    db.organization = { id: 1, orgKey: "deployza", status: "ACTIVE", name: "Deployza", hrNotifyEmail: "hr@deployza.com" };
  }
  return db.organization;
}

// Static catalog — no *.json fixture since it's not org-specific mutable data.
// Shape confirmed against the real GET /api/billing/plans response.
const BILLING_PLANS = [
  { code: "FREE", name: "Free", seatLimit: 5, priceMinor: 0, currency: "INR", billingPeriod: "MONTHLY", customPricing: false },
  { code: "STARTER", name: "Starter", seatLimit: 25, priceMinor: 99900, currency: "INR", billingPeriod: "MONTHLY", customPricing: false },
  { code: "GROWTH", name: "Growth", seatLimit: 100, priceMinor: 299900, currency: "INR", billingPeriod: "MONTHLY", customPricing: false },
  { code: "ENTERPRISE", name: "Enterprise", seatLimit: 2147483647, priceMinor: 0, currency: "INR", billingPeriod: "MONTHLY", customPricing: true },
];

// The single subscription row, same lazy-seed-and-mutate pattern as orgRow.
function billingRow(db) {
  if (!db.subscription) {
    db.subscription = { planCode: "FREE", planName: "Free", status: "ACTIVE", currentPeriodEnd: null };
  }
  return db.subscription;
}

// Session shape for /auth/me and /employees/me. ?status=PENDING previews the
// onboarding form without going through the invite link.
function sessionBody(db) {
  const me = db.employees[0];
  const manager = db.employees.find((e) => e.id === me.managerId);
  if (new URLSearchParams(location.search).get("status") === "PENDING") me.status = "PENDING";
  // ?emailVerified=false to preview the dashboard "verify your email" banner.
  const emailVerified = new URLSearchParams(location.search).get("emailVerified") !== "false";
  return Object.assign({}, me, { isManager: true, managerName: manager ? manager.name : null, emailVerified: emailVerified, organizationName: orgRow(db).name, orgKey: orgRow(db).orgKey, hasPhoto: !!me.hasPhoto });
}

// Statuses HR can only move to EXITED; fields PATCH /hr/employees/{id} accepts.
const MOCK_PRE_ACTIVE = ["INVITED", "PENDING", "ONBOARDED"];
const MOCK_EMP_EDITABLE = ["email", "role", "employeeCode", "name", "phone", "dateOfJoining", "dateOfExit", "employeeType", "designation", "department", "managerId", "basicSalary", "status"];

const MOCK_ONBOARDING_REQUIRED = {
  personal: ["phone", "dateOfBirth", "gender", "nationality", "maritalStatus", "personalEmail", "address1", "city", "state", "postalCode", "country"],
  emergency: ["emergencyName", "emergencyRelationship", "emergencyPhone"],
  payIds: ["bankAccount", "bankIfsc", "nationalId", "taxId"],
};
const MOCK_ONBOARDING_OPTIONAL = { personal: ["bloodGroup", "address2", "landmark"], emergency: [], payIds: ["passport"] };

const mockPick = (o, keys) => keys.reduce((r, k) => ((r[k] = o[k] == null ? null : o[k]), r), {});

// Only the onboarding-only (PENDING) session reaches /onboarding/**.
function onboardingGuard(db) {
  return db.employees[0].status === "PENDING" ? null : forbidden();
}

function onboardingData(db) {
  const me = db.employees[0];
  const o = db.onboarding || {};
  const done = (step) => MOCK_ONBOARDING_REQUIRED[step].every((f) => o[f]);
  const flags = { personalDone: done("personal"), emergencyDone: done("emergency"), payIdsDone: done("payIds") };
  const nextStep = !flags.personalDone ? "personal" : !flags.emergencyDone ? "emergency" : !flags.payIdsDone ? "payIds" : "review";
  return Object.assign({ name: me.name, email: me.email, status: me.status, nextStep }, flags, {
    phone: o.phone || null,
    personalInfo: mockPick(o, ["dateOfBirth", "gender", "nationality", "maritalStatus", "bloodGroup", "personalEmail"]),
    address: mockPick(o, ["address1", "address2", "city", "landmark", "postalCode", "state", "country"]),
    emergencyContact: mockPick(o, MOCK_ONBOARDING_REQUIRED.emergency),
  }, mockPick(o, ["bankAccount", "bankIfsc", "nationalId", "taxId", "passport"]));
}

// Each PUT replaces its step (blank optional = cleared); a rejected PUT changes nothing.
function saveOnboardingStep(db, step, body) {
  body = body || {};
  const fields = MOCK_ONBOARDING_REQUIRED[step].concat(MOCK_ONBOARDING_OPTIONAL[step]);
  const unknown = Object.keys(body).find((k) => fields.indexOf(k) === -1);
  if (unknown) return badRequest("Unknown property: " + unknown);
  const text = (f) => (body[f] == null ? "" : String(body[f]).trim());
  const missing = MOCK_ONBOARDING_REQUIRED[step].find((f) => !text(f));
  if (missing) return badRequest(missing + " is required.");
  db.onboarding = db.onboarding || {};
  fields.forEach((f) => (db.onboarding[f] = text(f)));
  return delay({ ok: true, status: 200, body: onboardingData(db) });
}

const routes = [
  { method: "POST", pattern: /^\/auth\/signup$/, handler: () => ok({}) },
  // First login after onboarding submit makes the user ACTIVE.
  { method: "POST", pattern: /^\/auth\/login$/, handler: (db) => {
      if (db.employees[0].status === "ONBOARDED") db.employees[0].status = "ACTIVE";
      return ok({});
    } },
  { method: "POST", pattern: /^\/auth\/change-password$/, handler: () => ok({}) },
  { method: "GET", pattern: /^\/auth\/verify-email$/, handler: (db, m, body, query) => (query.get("token") ? ok({}) : badRequest("Missing verification token.")) },
  { method: "POST", pattern: /^\/auth\/resend-verification$/, handler: () => ok({}) },
  { method: "POST", pattern: /^\/auth\/forgot-password$/, handler: (db, m, body) => ((body && body.orgKey) === orgRow(db).orgKey ? ok({}) : notFound("organization not found")) },
  { method: "POST", pattern: /^\/auth\/reset-password$/, handler: (db, m, body) => (body && body.token ? ok({}) : badRequest("This reset link is invalid or has expired.")) },
  // Invite-link landing page (set-password.html). Consumes the invite
  // (INVITED -> PENDING); real mode also sets an onboarding-only session,
  // mock mode just reflects PENDING on the next /auth/me.
  { method: "POST", pattern: /^\/auth\/set-password$/, handler: (db, m, body) => {
      if (!body || !body.token || !body.newPassword) return badRequest("This invite link is invalid or has expired.");
      db.employees[0].status = "PENDING";
      return ok({});
    } },
  { method: "GET", pattern: /^\/auth\/me$/, handler: (db) => delay({ ok: true, status: 200, body: sessionBody(db) }) },
  { method: "POST", pattern: /^\/auth\/logout$/, handler: () => ok({}) },

  { method: "GET", pattern: /^\/leave-balances\/me$/, handler: (db) => delay({ ok: true, status: 200, body: db.balancesByEmployee[db.employees[0].id] || [] }) },
  { method: "GET", pattern: /^\/leave-requests\/me$/, handler: (db, m, body, query) => {
      const rows = db.leaveRequests.filter((r) => r.employeeId === db.employees[0].id).slice().sort((a, b) => b.id - a.id).map(toSummaryRow);
      return delay({ ok: true, status: 200, body: query.get("recent") ? rows.slice(0, 3) : rows });
    } },
  { method: "GET", pattern: /^\/leave-types$/, handler: (db) => delay({ ok: true, status: 200, body: employeeLeaveTypes(db) }) },
  { method: "POST", pattern: /^\/leave-requests$/, handler: () => ok({ id: 110, status: "APPLIED" }) },
  { method: "GET", pattern: /^\/leave-requests\/(\d+)$/, handler: (db, m) => {
      const r = db.leaveRequests.find((x) => String(x.id) === m[1]);
      return r ? delay({ ok: true, status: 200, body: r }) : notFound("Leave request not found.");
    } },
  { method: "POST", pattern: /^\/leave-requests\/(\d+)\/action$/, handler: () => ok({}) },
  { method: "POST", pattern: /^\/leave-requests\/(\d+)\/cancel$/, handler: () => ok({}) },

  { method: "GET", pattern: /^\/employees\/me$/, handler: (db) => delay({ ok: true, status: 200, body: sessionBody(db) }) },
  // Onboarding (employee-onboarding.md): the PENDING user's own form.
  { method: "GET", pattern: /^\/onboarding$/, handler: (db) => onboardingGuard(db) || delay({ ok: true, status: 200, body: onboardingData(db) }) },
  { method: "PUT", pattern: /^\/onboarding\/personal$/, handler: (db, m, body) => onboardingGuard(db) || saveOnboardingStep(db, "personal", body) },
  { method: "PUT", pattern: /^\/onboarding\/emergency$/, handler: (db, m, body) => onboardingGuard(db) || saveOnboardingStep(db, "emergency", body) },
  { method: "PUT", pattern: /^\/onboarding\/pay-ids$/, handler: (db, m, body) => onboardingGuard(db) || saveOnboardingStep(db, "payIds", body) },
  { method: "POST", pattern: /^\/onboarding\/submit$/, handler: (db) => {
      const denied = onboardingGuard(db);
      if (denied) return denied;
      const data = onboardingData(db);
      if (data.nextStep !== "review") return badRequest("Onboarding is incomplete: " + data.nextStep + " step is missing.");
      Object.assign(db.employees[0], db.onboarding, { status: "ONBOARDED" });
      return ok({});
    } },

  // Admin invites (ORG_ADMIN only).
  { method: "POST", pattern: /^\/admin\/users$/, handler: (db, m, body) => {
      if (db.employees[0].role !== "ORG_ADMIN") return forbidden("Only an organization admin can invite users.");
      body = body || {};
      const name = normalizeText(body.name);
      const email = normalizeEmail(body.email);
      if (!name || !email) return badRequest("Name and email are required.");
      if (body.role !== "EMPLOYEE" && body.role !== "HR") return badRequest("Role must be EMPLOYEE or HR.");
      if (db.employees.some((e) => normalizeEmail(e.email) === email)) return conflict("That email is already in use.");
      const id = maxId(db.employees) + 1;
      db.employees.push({ id, employeeCode: "EMP-" + String(id).padStart(5, "0"), name, email, emailVerified: false, phone: "", role: body.role,
        managerId: null, department: "", designation: "", employeeType: "REGULAR", dateOfJoining: todayIso(), dateOfExit: null, basicSalary: null, status: "INVITED" });
      return ok({ id });
    } },
  { method: "POST", pattern: /^\/admin\/users\/(\d+)\/resend-invite$/, handler: (db, m) => {
      if (db.employees[0].role !== "ORG_ADMIN") return forbidden("Only an organization admin can resend invites.");
      const e = db.employees.find((x) => x.id === Number(m[1]));
      if (!e) return notFound("User not found.");
      return e.status === "INVITED" ? ok({}) : badRequest("Only an invited user can be sent a new invite.");
    } },

  { method: "PATCH", pattern: /^\/employees\/me$/, handler: () => ok({}) },
  // Mock mode has no static byte host, so an <img> against this URL still 404s -
  // only the hasPhoto flag toggles for real, so the change/remove UI has something to react to.
  { method: "PUT", pattern: /^\/employees\/me\/photo$/, handler: (db) => {
      db.employees[0].hasPhoto = true;
      return ok({ hasPhoto: true });
    } },
  { method: "DELETE", pattern: /^\/employees\/me\/photo$/, handler: (db) => {
      db.employees[0].hasPhoto = false;
      return ok({ hasPhoto: false });
    } },

  { method: "GET", pattern: /^\/organization$/, handler: (db) => delay({ ok: true, status: 200, body: orgRow(db) }) },
  { method: "PATCH", pattern: /^\/organization$/, handler: (db, m, body) => {
      const org = orgRow(db);
      body = body || {};
      if (body.name !== undefined && body.name !== null) {
        const trimmed = String(body.name).trim();
        org.name = trimmed === "" ? null : trimmed;
      }
      if (body.hrNotifyEmail !== undefined && body.hrNotifyEmail !== null) {
        const email = String(body.hrNotifyEmail).trim();
        if (email === "" || email.indexOf("@") === -1) return badRequest("A valid HR notification email is required.");
        org.hrNotifyEmail = email;
      }
      return ok(org);
    } },

  { method: "GET", pattern: /^\/billing\/plans$/, handler: () => delay({ ok: true, status: 200, body: BILLING_PLANS }) },
  { method: "GET", pattern: /^\/billing\/subscription$/, handler: (db) => delay({ ok: true, status: 200, body: billingRow(db) }) },
  { method: "POST", pattern: /^\/billing\/subscribe$/, handler: (db, m, body) => {
      const plan = BILLING_PLANS.find((p) => p.code === (body && body.planCode));
      if (!plan) return badRequest("Unknown plan.");
      const sub = billingRow(db);
      sub.planCode = plan.code;
      sub.planName = plan.name;
      sub.status = "ACTIVE";
      sub.currentPeriodEnd = plan.code === "FREE" ? null : todayIso();
      return ok({});
    } },
  { method: "POST", pattern: /^\/billing\/cancel$/, handler: (db) => {
      const sub = billingRow(db);
      sub.planCode = "FREE";
      sub.planName = "Free";
      sub.status = "ACTIVE";
      sub.currentPeriodEnd = null;
      return ok({});
    } },

  { method: "GET", pattern: /^\/manager\/leave-requests$/, handler: (db) => {
      const me = db.employees[0];
      const reportIds = db.employees.filter((e) => e.managerId === me.id).map((e) => e.id);
      const rows = db.leaveRequests.filter((r) => reportIds.indexOf(r.employeeId) !== -1).slice().sort((a, b) => b.id - a.id).map(toSummaryRow);
      return delay({ ok: true, status: 200, body: rows });
    } },
  { method: "GET", pattern: /^\/manager\/team$/, handler: (db) => {
      const me = db.employees[0];
      const rows = db.employees.filter((e) => e.managerId === me.id).map((e) => ({ id: e.id, name: e.name, designation: e.designation, department: e.department, balances: db.balancesByEmployee[e.id] || [] }));
      return delay({ ok: true, status: 200, body: rows });
    } },

  { method: "GET", pattern: /^\/hr\/leave-requests$/, handler: (db) => delay({ ok: true, status: 200, body: db.leaveRequests.slice().sort((a, b) => b.id - a.id).map(toSummaryRow) }) },
  { method: "GET", pattern: /^\/hr\/employees$/, handler: (db) => delay({ ok: true, status: 200, body: db.employees.map((e) => Object.assign({}, e)) }) },
  { method: "GET", pattern: /^\/hr\/employees\/(\d+)$/, handler: (db, m) => {
      const e = db.employees.find((x) => x.id === Number(m[1]));
      return delay({ ok: true, status: 200, body: e ? Object.assign({}, e) : null });
    } },
  { method: "PATCH", pattern: /^\/hr\/employees\/(\d+)$/, handler: (db, m, body) => {
      const e = db.employees.find((x) => x.id === Number(m[1]));
      if (!e) return notFound("Employee not found.");
      body = body || {};
      if (body.status && body.status !== e.status && MOCK_PRE_ACTIVE.indexOf(e.status) !== -1 && body.status !== "EXITED") {
        return badRequest("The status of an invited, pending or onboarded user can only be changed to Exited.");
      }
      MOCK_EMP_EDITABLE.forEach((k) => {
        if (body[k] !== undefined && body[k] !== null && body[k] !== "") e[k] = body[k];
      });
      return ok(Object.assign({}, e));
    } },
  { method: "PATCH", pattern: /^\/hr\/employees\/(\d+)\/details$/, handler: (db, m, body) => {
      const e = db.employees.find((x) => x.id === Number(m[1]));
      if (!e) return notFound("Employee not found.");
      body = body || {};
      if (body.phone != null) e.phone = body.phone;
      ["personalInfo", "address", "emergencyContact", "payIds"].forEach((section) => Object.assign(e, body[section] || {}));
      return ok({});
    } },
  { method: "DELETE", pattern: /^\/hr\/employees\/(\d+)$/, handler: (db, m) => {
      // Soft-delete, idempotent — mutate in place so a reload reflects it.
      const e = db.employees.find((x) => x.id === Number(m[1]));
      if (e) { e.isActive = false; e.status = "EXITED"; }
      return ok({});
    } },
  { method: "POST", pattern: /^\/hr\/employees\/reassign-manager$/, handler: () => ok({}) },
  { method: "POST", pattern: /^\/hr\/leave-requests\/lop$/, handler: () => ok({ id: 103, status: "APPROVED" }) },
  { method: "POST", pattern: /^\/hr\/leave-requests\/(\d+)\/override$/, handler: () => ok({}) },

  /* Employee Directory — the tiered read surface, with an ORG_ADMIN-only
   * write side. Scope comes from the signed-in user's role and the manager
   * graph (js/directory-scope.js), never from a request parameter, and only
   * P0/P1 fields are returned or accepted. Kept separate from the
   * /hr/employees routes above on purpose: those stay HR's full-field
   * surface, salary included.
   *
   * Mock role switching: the signed-in user is db.employees[0] (Jordan Lee,
   * who has direct reports), so ?role=EMPLOYEE lands in REPORTS scope and
   * the default ORG_ADMIN lands in ORG. SELF needs a user with no reports,
   * which this fixture set has no way to make current. */
  { method: "GET", pattern: /^\/directory$/, handler: (db, m, body, query) => {
      const me = db.employees[0];
      const scope = resolveDirectoryScope(me, db.employees);
      // Admin-only filter, failing closed rather than being quietly ignored:
      // a response that dropped a filter the caller asked for would lie.
      if (query.get("managerId") && scope !== "ORG") {
        return forbidden("Filtering by manager needs organization-wide access.");
      }
      // ORG_ADMIN and HR get the personal/address/emergency/pay block (masked);
      // managers and employees never do -- role, not ORG scope, decides.
      const withSensitive = me.role === "ORG_ADMIN" || me.role === "HR";
      const rows = directoryCandidates(db.employees, scope, me.id)
        .map((e) => toDirectoryRow(e, withSensitive))
        .filter((r) =>
          directoryMatchesFilters(r, {
            department: query.get("department"),
            managerId: query.get("managerId"),
            search: query.get("search"),
          })
        );
      return delay({
        ok: true,
        status: 200,
        body: directoryPage(rows, Number(query.get("page")) || 0, Number(query.get("size")) || 50),
      });
    } },

  { method: "GET", pattern: /^\/hr\/leave-types$/, handler: (db) => delay({ ok: true, status: 200, body: db.leaveTypesCatalog }) },
  { method: "POST", pattern: /^\/hr\/leave-types$/, handler: (db) => ok({ id: db.leaveTypesCatalog.length + 1 }) },
  { method: "PATCH", pattern: /^\/hr\/leave-types\/(\d+)$/, handler: () => ok({}) },
  { method: "DELETE", pattern: /^\/hr\/leave-types\/(\d+)$/, handler: () => ok({}) },

  { method: "GET", pattern: /^\/hr\/holidays$/, handler: (db, m, body, query) => {
      const year = Number(query.get("year")) || new Date().getFullYear();
      return delay({ ok: true, status: 200, body: db.holidays.filter((h) => h.year === year) });
    } },
  { method: "POST", pattern: /^\/hr\/holidays$/, handler: (db, m, body) => {
      if (!body || !body.name || !body.date) return badRequest("Name and date are required.");
      if (db.holidays.some((h) => h.date === body.date)) return conflict("A holiday already exists on that date.");
      const id = db.holidays.length ? Math.max(...db.holidays.map((h) => h.id)) + 1 : 1;
      db.holidays.push({ id, name: body.name, date: body.date, year: Number(body.date.slice(0, 4)), nonNegotiable: !!body.nonNegotiable });
      return ok({ id });
    } },
  { method: "PATCH", pattern: /^\/hr\/holidays\/(\d+)$/, handler: (db, m, body) => {
      const holiday = db.holidays.find((h) => h.id === Number(m[1]));
      if (!holiday) return notFound("Holiday not found.");
      if (body && body.date && db.holidays.some((h) => h.date === body.date && h.id !== holiday.id)) {
        return conflict("A holiday already exists on that date.");
      }
      if (body && body.name !== undefined) holiday.name = body.name;
      if (body && body.date !== undefined) {
        holiday.date = body.date;
        holiday.year = Number(body.date.slice(0, 4));
      }
      if (body && body.nonNegotiable !== undefined) holiday.nonNegotiable = !!body.nonNegotiable;
      return ok({});
    } },
  { method: "DELETE", pattern: /^\/hr\/holidays\/(\d+)$/, handler: (db, m) => {
      db.holidays = db.holidays.filter((h) => h.id !== Number(m[1]));
      return ok({});
    } },

  { method: "GET", pattern: /^\/hr\/lop-watchlist$/, handler: (db) => {
      const flags = db.leaveRequests
        .filter((r) => r.leaveTypeCode === "LOP" && r.isHrImposed)
        .map((r) => ({ employeeName: r.employeeName, lopStartDate: r.startDate, lopEndDate: r.endDate, flaggedAt: "2026-08-08" }));
      return delay({ ok: true, status: 200, body: flags });
    } },

  { method: "GET", pattern: /^\/hr\/exit\/(\d+)$/, handler: () => delay({ ok: true, status: 200, body: { employeeId: 2, status: "DRAFT" } }) },
  { method: "POST", pattern: /^\/hr\/exit\/(\d+)\/finalize$/, handler: () => ok({}) },

  { method: "GET", pattern: /^\/hr\/audit-log$/, handler: (db) => delay({ ok: true, status: 200, body: db.auditLog }) },

  { method: "GET", pattern: /^\/notifications\/me$/, handler: (db, m, body, query) => {
      const rows = db.notifications.filter((n) => n.employeeId === db.employees[0].id);
      return delay({ ok: true, status: 200, body: query.get("unread") ? rows.filter((n) => !n.isRead) : rows });
    } },

  { method: "GET", pattern: /^\/one-on-ones\/sessions\/me$/, handler: (db) => delay({ ok: true, status: 200, body: db.oneOnOneSessions }) },
  { method: "POST", pattern: /^\/one-on-ones\/sessions$/, handler: () => ok({ id: 202 }) },
  { method: "GET", pattern: /^\/one-on-ones\/sessions\/(\d+)$/, handler: (db) => delay({ ok: true, status: 200, body: db.oneOnOneDetail }) },
  { method: "PUT", pattern: /^\/one-on-ones\/sessions\/(\d+)\/agenda$/, handler: () => ok({}) },
  { method: "PUT", pattern: /^\/one-on-ones\/sessions\/(\d+)\/notes$/, handler: () => ok({}) },
  { method: "POST", pattern: /^\/one-on-ones\/sessions\/(\d+)\/complete$/, handler: () => ok({}) },
  { method: "POST", pattern: /^\/one-on-ones\/sessions\/(\d+)\/cancel$/, handler: () => ok({}) },
  { method: "POST", pattern: /^\/one-on-ones\/sessions\/(\d+)\/action-items$/, handler: () => ok({ id: 302 }) },
  { method: "PATCH", pattern: /^\/one-on-ones\/sessions\/(\d+)\/action-items\/(\d+)$/, handler: () => ok({}) },

  { method: "GET", pattern: /^\/appraisals\/me$/, handler: (db) => delay({ ok: true, status: 200, body: db.appraisals.filter((a) => a.employeeId === db.employees[0].id).map((a) => toMyAppraisalRow(db, a)) }) },
  { method: "GET", pattern: /^\/appraisals\/(\d+)$/, handler: (db, m) => {
      const a = db.appraisals.find((x) => String(x.id) === m[1]);
      return a ? delay({ ok: true, status: 200, body: toAppraisalDetail(db, a) }) : notFound("Appraisal not found.");
    } },
  { method: "POST", pattern: /^\/appraisals\/(\d+)\/self-review$/, handler: (db, m, body) => {
      const a = db.appraisals.find((x) => x.id === Number(m[1]));
      if (!a) return notFound("Appraisal not found.");
      a.selfRatingValueId = body.selfRatingValueId;
      a.selfComments = body.selfComments;
      a.selfCategories = body.selfCategories || [];
      a.status = "MANAGER_REVIEW";
      return ok({});
    } },
  { method: "GET", pattern: /^\/appraisals\/team$/, handler: (db) => delay({ ok: true, status: 200, body: db.appraisals.filter((a) => a.managerId === db.employees[0].id).map((a) => toTeamAppraisalRow(db, a)) }) },
  { method: "POST", pattern: /^\/appraisals\/(\d+)\/manager-review$/, handler: (db, m, body) => {
      const a = db.appraisals.find((x) => x.id === Number(m[1]));
      if (!a) return notFound("Appraisal not found.");
      a.managerRatingValueId = body.managerRatingValueId;
      a.managerComments = body.managerComments;
      a.managerCategories = body.managerCategories || [];
      // Same target whether this is the first submission or a re-submission
      // after HR RETURNED it - either way it goes back into HR's queue.
      a.status = "HR_REVIEW";
      a.returnReason = null;
      return ok({});
    } },
  { method: "POST", pattern: /^\/appraisals\/(\d+)\/advance-to-calibration$/, handler: (db, m) => {
      const a = db.appraisals.find((x) => x.id === Number(m[1]));
      if (!a) return notFound("Appraisal not found.");
      a.status = "CALIBRATION";
      return ok({});
    } },
  { method: "POST", pattern: /^\/appraisals\/(\d+)\/finalize$/, handler: (db, m) => {
      const a = db.appraisals.find((x) => x.id === Number(m[1]));
      if (!a) return notFound("Appraisal not found.");
      a.status = "FINALIZED";
      return ok({});
    } },
  { method: "POST", pattern: /^\/appraisals\/(\d+)\/return-to-manager$/, handler: (db, m, body) => {
      const a = db.appraisals.find((x) => x.id === Number(m[1]));
      if (!a) return notFound("Appraisal not found.");
      a.status = "RETURNED";
      a.returnReason = (body && body.reason) || null;
      return ok({});
    } },
  { method: "POST", pattern: /^\/appraisals\/(\d+)\/reopen$/, handler: (db, m, body) => {
      const a = db.appraisals.find((x) => x.id === Number(m[1]));
      if (!a) return notFound("Appraisal not found.");
      a.status = "REOPENED";
      a.reopenReason = (body && body.reason) || null;
      return ok({});
    } },
  { method: "POST", pattern: /^\/appraisals\/(\d+)\/cancel$/, handler: (db, m) => {
      const a = db.appraisals.find((x) => x.id === Number(m[1]));
      if (!a) return notFound("Appraisal not found.");
      a.status = "CANCELLED";
      return ok({});
    } },
  { method: "POST", pattern: /^\/appraisals\/(\d+)\/acknowledge$/, handler: (db, m) => {
      const a = db.appraisals.find((x) => x.id === Number(m[1]));
      if (!a) return notFound("Appraisal not found.");
      a.status = "ACKNOWLEDGED";
      return ok({});
    } },
  { method: "PATCH", pattern: /^\/appraisals\/(\d+)\/calibrate$/, handler: (db, m, body) => {
      const a = db.appraisals.find((x) => x.id === Number(m[1]));
      if (!a) return notFound("Appraisal not found.");
      const calibratedScore = body && body.calibratedScore != null ? Number(body.calibratedScore) : null;
      const reason = (body && body.calibrationReason) || null;
      if (calibrationNeedsReason(managerScoreFor(db, a), calibratedScore) && !reason) {
        return badRequest("A reason is required when the calibrated score differs from the manager's score.");
      }
      a.calibratedScore = calibratedScore;
      a.calibrationReason = reason;
      return ok({});
    } },
  { method: "POST", pattern: /^\/appraisals\/goals$/, handler: (db, m, body) => {
      const a = db.appraisals.find((x) => x.cycleId === body.cycleId && x.employeeId === body.employeeId);
      if (!a) return notFound("Appraisal not found for that cycle/employee.");
      const goal = { id: db._nextGoalId++, description: body.description, status: body.status || "NOT_STARTED" };
      a.goals = (a.goals || []).concat([goal]);
      return ok({ id: goal.id });
    } },
  { method: "PATCH", pattern: /^\/appraisals\/goals\/(\d+)$/, handler: (db, m, body) => {
      const goalId = Number(m[1]);
      for (const a of db.appraisals) {
        const goal = (a.goals || []).find((g) => g.id === goalId);
        if (goal) {
          Object.assign(goal, body);
          return ok({});
        }
      }
      return notFound("Goal not found.");
    } },

  { method: "GET", pattern: /^\/hr\/appraisal-cycles$/, handler: (db) => delay({ ok: true, status: 200, body: db.appraisalCycles }) },
  { method: "POST", pattern: /^\/hr\/appraisal-cycles$/, handler: (db, m, body) => {
      const cycle = Object.assign({ id: db._nextCycleId++, status: "DRAFT", categories: [] }, body);
      db.appraisalCycles.push(cycle);
      return ok({ id: cycle.id });
    } },
  { method: "POST", pattern: /^\/hr\/appraisal-cycles\/(\d+)\/open$/, handler: (db, m) => {
      const cycle = db.appraisalCycles.find((c) => c.id === Number(m[1]));
      if (cycle) cycle.status = "OPEN";
      return ok({});
    } },
  { method: "POST", pattern: /^\/hr\/appraisal-cycles\/(\d+)\/close$/, handler: (db, m) => {
      const cycle = db.appraisalCycles.find((c) => c.id === Number(m[1]));
      if (!cycle) return ok({});
      cycle.status = "CLOSED";
      // Mirrors 17-module-appraisal.md's "flag, don't auto-act" stance: only
      // reviews that actually reached the end of the chain get swept to
      // CLOSED. Anything still earlier (HR_REVIEW, RETURNED, ...) is left as
      // a visible exception for HR rather than silently force-closed.
      db.appraisals
        .filter((a) => a.cycleId === cycle.id && (a.status === "ACKNOWLEDGED" || a.status === "FINALIZED"))
        .forEach((a) => (a.status = "CLOSED"));
      return ok({});
    } },
  { method: "PUT", pattern: /^\/hr\/appraisal-cycles\/(\d+)\/categories$/, handler: (db, m, body) => {
      const cycle = db.appraisalCycles.find((c) => c.id === Number(m[1]));
      if (cycle) cycle.categories = body;
      return ok({});
    } },
  { method: "GET", pattern: /^\/hr\/appraisal-cycles\/(\d+)\/appraisals$/, handler: (db, m) => delay({ ok: true, status: 200, body: db.appraisals.filter((a) => a.cycleId === Number(m[1])).map((a) => toHrRosterRow(db, a)) }) },
  // Calibration Panel data - 18-appraisal-enterprise-expansion.md's HR
  // Calibration section: department averages (using each employee's
  // effective/calibrated-if-set score) plus a per-employee self/manager/
  // calibrated comparison row for anyone with a manager score to compare.
  { method: "GET", pattern: /^\/hr\/appraisal-cycles\/(\d+)\/calibration$/, handler: (db, m) => {
      const cid = Number(m[1]);
      const cycleAppraisals = db.appraisals.filter((a) => a.cycleId === cid);
      const rows = cycleAppraisals
        .filter((a) => managerScoreFor(db, a) != null)
        .map((a) => ({
          id: a.id,
          employeeName: a.employeeName,
          department: a.snapshot ? a.snapshot.department : null,
          status: a.status,
          selfScore: selfScoreFor(a),
          managerScore: managerScoreFor(db, a),
          calibratedScore: a.calibratedScore != null ? a.calibratedScore : null,
          calibrationReason: a.calibrationReason || null,
        }));

      const byDepartment = {};
      cycleAppraisals.forEach((a) => {
        const dept = a.snapshot ? a.snapshot.department : null;
        const score = finalScoreFor(db, a);
        if (!dept || score == null) return;
        (byDepartment[dept] = byDepartment[dept] || []).push(score);
      });
      const departmentAverages = Object.keys(byDepartment)
        .map((dept) => ({ department: dept, avgScore: byDepartment[dept].reduce((sum, s) => sum + s, 0) / byDepartment[dept].length }))
        .sort((a, b) => b.avgScore - a.avgScore);

      return delay({ ok: true, status: 200, body: { departmentAverages: departmentAverages, rows: rows } });
    } },
  { method: "POST", pattern: /^\/hr\/appraisal-cycles\/(\d+)\/roster-import$/, handler: (db, m, body) => {
      const cid = Number(m[1]);
      const rows = (body && body.rows) || [];
      const created = [];
      const skipped = [];
      rows.forEach((row) => {
        const email = (row.email || "").trim().toLowerCase();
        const employee = db.employees.find((e) => e.email.toLowerCase() === email);
        if (!employee) {
          skipped.push((row.email || row.name || "(blank row)") + " - no matching employee");
          return;
        }
        if (db.appraisals.some((a) => a.cycleId === cid && a.employeeId === employee.id)) {
          skipped.push(employee.name + " - already in this cycle");
          return;
        }
        const manager = db.employees.find((e) => e.name.trim().toLowerCase() === (row.manager || "").trim().toLowerCase());
        const managerId = manager ? manager.id : employee.managerId;
        const managerRecord = manager || db.employees.find((e) => e.id === employee.managerId);
        db.appraisals.push({
          id: db._nextAppraisalId++,
          cycleId: cid,
          employeeId: employee.id,
          employeeName: employee.name,
          managerId: managerId,
          // Snapshotted at roster assignment - 18-appraisal-enterprise-
          // expansion.md's Employee Snapshot. Every appraisal renderer below
          // reads from this, never from a live db.employees lookup, so a
          // later department/designation/manager change doesn't retroactively
          // alter what an already-open or closed cycle shows.
          snapshot: {
            name: employee.name,
            email: employee.email,
            department: employee.department,
            designation: employee.designation,
            managerName: managerRecord ? managerRecord.name : null,
            organization: "Deployza",
            dateOfJoining: employee.dateOfJoining,
          },
          status: "SELF_APPRAISAL",
          selfRatingValueId: null,
          selfComments: null,
          selfCategories: [],
          managerRatingValueId: null,
          managerComments: null,
          managerCategories: [],
          goals: [],
        });
        created.push(employee.name);
      });
      return ok({ created: created.length, skipped: skipped });
    } },
  { method: "GET", pattern: /^\/hr\/appraisal-rating-values$/, handler: (db) => delay({ ok: true, status: 200, body: db.appraisalRatingValues }) },
  { method: "POST", pattern: /^\/hr\/appraisal-rating-values$/, handler: (db, m, body) => {
      const value = Object.assign({ id: db._nextRatingValueId++, sortOrder: db.appraisalRatingValues.length + 1 }, body);
      db.appraisalRatingValues.push(value);
      return ok({ id: value.id });
    } },

  { method: "GET", pattern: /^\/hr\/appraisal-performance-levels$/, handler: (db) => delay({ ok: true, status: 200, body: db.performanceLevels }) },
  { method: "PUT", pattern: /^\/hr\/appraisal-performance-levels$/, handler: (db, m, body) => {
      db.performanceLevels = body || [];
      return ok({});
    } },
];

window.mockFetch = async function (path, method, body) {
  const db = await dataReady();
  const parts = path.split("?");
  const pathname = parts[0];
  const search = parts[1];
  const query = new URLSearchParams(search || "");

  for (const route of routes) {
    if (route.method !== method) continue;
    const m = route.pattern.exec(pathname);
    if (m) {
      const result = await route.handler(db, m, body, query);
      if (method !== "GET") persistDb(db);
      return result;
    }
  }
  return delay({ ok: false, status: 404, body: { summary: "No mock route for " + method + " " + path } });
};
