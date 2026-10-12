/* Named-endpoint facade over apiFetch() (js/utils.js) - the one canonical
 * fetch wrapper (api-response-handling.md). apiFetch owns the config-driven
 * base URL, the mock/real routing (single flag read, see mock-data.md), the
 * loading overlay, and the {ok,status,body} contract; this file only maps
 * friendly method names to endpoint paths so the ~24 page scripts below
 * don't repeat raw path strings. Every call still resolves through apiFetch
 * - this is not a second wrapper definition, just a lookup table. Kept
 * outside js/api/ (reserved for one-file-per-page feature scripts by
 * file-organization.md) since it isn't a feature file.
 *
 * On failure the returned promise rejects with an Error carrying .status and
 * .body (the ErrorData shape from api-response-handling.md), so callers that
 * need to branch on status still can - see js/api/login.js's 404 org-not-found
 * branch for an example. Cookie-based auth (discussion.md #5) - never
 * reads/stores a token; the browser attaches the HttpOnly JWT cookie
 * automatically. */

const apiClient = (function () {
  // Capitalize the first letter of each word in people's names, in place, so every
  // page shows "alex kim" as "Alex Kim". Person fields: employeeName/managerName,
  // and `name` only on objects that also carry email/designation/department
  // (leave types, holidays, categories have a `name` too and keep their casing).
  const NAME_KEYS = ["employeeName", "managerName"];
  const PERSON_KEYS = ["email", "designation", "department"];
  const capitalizeWords = (s) => s.replace(/(^|\s)(\S)/g, (m, sp, ch) => sp + ch.toUpperCase());
  function capitalizeNames(node) {
    if (Array.isArray(node)) return node.forEach(capitalizeNames);
    if (!node || typeof node !== "object") return;
    Object.keys(node).forEach((k) => {
      const v = node[k];
      if (typeof v === "string" && (NAME_KEYS.includes(k) || (k === "name" && PERSON_KEYS.some((p) => p in node)))) node[k] = capitalizeWords(v);
      else capitalizeNames(v);
    });
  }

  function call(path, method, body, opts) {
    return apiFetch(path, method, body, opts).then((res) => {
      if (!res.ok) {
        const summary = res.body && res.body.summary;
        const err = new Error(summary || "Request failed (" + res.status + ")");
        err.status = res.status;
        err.body = res.body;
        throw err;
      }
      capitalizeNames(res.body);
      return res.body;
    });
  }

  function toQuery(filters) {
    if (!filters) return "";
    const params = new URLSearchParams(filters);
    const str = params.toString();
    return str ? "?" + str : "";
  }

  return {
    signup: (orgKey, email, password, country, captchaToken) =>
      call("/auth/signup", "POST", { orgKey, email, password, country, captchaToken }),
    login: (orgKey, email, password, captchaToken) => call("/auth/login", "POST", { orgKey, email, password, captchaToken }),
    changePassword: (currentPassword, newPassword) =>
      call("/auth/change-password", "POST", { currentPassword, newPassword }),
    me: () => call("/auth/me", "GET"),
    logout: () => call("/auth/logout", "POST"),
    verifyEmail: (token) => call("/auth/verify-email?token=" + encodeURIComponent(token), "GET"),
    resendVerificationEmail: () => call("/auth/resend-verification", "POST"),
    forgotPassword: (orgKey, email, captchaToken) => call("/auth/forgot-password", "POST", { orgKey, email, captchaToken }),
    resetPassword: (token, newPassword) => call("/auth/reset-password", "POST", { token, newPassword }),
    // Establishes an onboarding-only session on success (INVITED -> PENDING);
    // the next page is onboarding.html.
    setPassword: (token, newPassword) => call("/auth/set-password", "POST", { token, newPassword }),

    myBalances: () => call("/leave-balances/me", "GET"),
    myRecentRequests: () => call("/leave-requests/me?recent=true", "GET"),
    myRequests: () => call("/leave-requests/me", "GET"),
    leaveTypes: () => call("/leave-types", "GET"),
    applyForLeave: (payload) => call("/leave-requests", "POST", payload),
    getLeaveRequest: (id) => call(`/leave-requests/${id}`, "GET"),
    actOnLeaveRequest: (id, action, comments) =>
      call(`/leave-requests/${id}/action`, "POST", { action, comments }),
    cancelLeaveRequest: (id) => call(`/leave-requests/${id}/cancel`, "POST"),

    myProfile: () => call("/employees/me", "GET"),
    updateMyProfile: (payload) => call("/employees/me", "PATCH", payload),
    // Invited user's own onboarding form (ROLE_ONBOARDING session only).
    onboarding: () => call("/onboarding", "GET"),
    saveOnboardingPersonal: (payload) => call("/onboarding/personal", "PUT", payload),
    saveOnboardingEmergency: (payload) => call("/onboarding/emergency", "PUT", payload),
    saveOnboardingPayIds: (payload) => call("/onboarding/pay-ids", "PUT", payload),
    submitOnboarding: () => call("/onboarding/submit", "POST"),
    uploadMyPhoto: (formData) => call("/employees/me/photo", "PUT", formData),
    deleteMyPhoto: () => call("/employees/me/photo", "DELETE"),

    organization: () => call("/organization", "GET"),
    updateOrganization: (payload) => call("/organization", "PATCH", payload),

    billingPlans: () => call("/billing/plans", "GET"),
    billingSubscription: () => call("/billing/subscription", "GET"),
    subscribe: (planCode) => call("/billing/subscribe", "POST", { planCode }),
    cancelSubscription: () => call("/billing/cancel", "POST"),

    managerTeamRequests: () => call("/manager/leave-requests", "GET"),
    managerTeam: () => call("/manager/team", "GET"),

    hrRequests: (filters) => call("/hr/leave-requests" + toQuery(filters), "GET"),
    hrEmployees: (filters) => call("/hr/employees" + toQuery(filters), "GET"),
    getHrEmployee: (id) => call(`/hr/employees/${id}`, "GET"),
    updateHrEmployee: (id, payload) => call(`/hr/employees/${id}`, "PATCH", payload),
    updateHrEmployeeDetails: (id, payload) => call(`/hr/employees/${id}/details`, "PATCH", payload),
    // ORG_ADMIN only. Users are only ever created by invite (or bulk import).
    inviteUser: (payload) => call("/admin/users", "POST", payload),
    resendInvite: (id) => call(`/admin/users/${id}/resend-invite`, "POST"),
    deleteHrEmployee: (id) => call(`/hr/employees/${id}`, "DELETE"),
    importHrEmployees: (rows) => call("/hr/employees/import", "POST", { rows }),
    reassignManager: (payload) => call("/hr/employees/reassign-manager", "POST", payload),
    imposeLop: (payload) => call("/hr/leave-requests/lop", "POST", payload),
    overrideLeaveRequest: (id, payload) => call(`/hr/leave-requests/${id}/override`, "POST", payload),

    /* Employee Directory — read only. Open to any authenticated session; the
     * server decides whether that means the whole org, the caller's direct
     * reports, or only their own row. ORG_ADMIN and HR also get the personal,
     * address, emergency and pay details (sensitive numbers masked). */
    directory: (filters) => call("/directory" + toQuery(filters), "GET"),

    hrLeaveTypes: () => call("/hr/leave-types", "GET"),
    createHrLeaveType: (payload) => call("/hr/leave-types", "POST", payload),
    updateHrLeaveType: (id, payload) => call(`/hr/leave-types/${id}`, "PATCH", payload),
    deleteHrLeaveType: (id) => call(`/hr/leave-types/${id}`, "DELETE"),

    hrHolidays: (year) => call("/hr/holidays" + (year ? "?year=" + year : ""), "GET"),
    createHrHoliday: (payload) => call("/hr/holidays", "POST", payload),
    updateHrHoliday: (id, payload) => call(`/hr/holidays/${id}`, "PATCH", payload),
    deleteHrHoliday: (id) => call(`/hr/holidays/${id}`, "DELETE"),

    hrLopWatchlist: () => call("/hr/lop-watchlist", "GET"),

    hrExit: (employeeId) => call(`/hr/exit/${employeeId}`, "GET"),
    finalizeExit: (employeeId, payload) => call(`/hr/exit/${employeeId}/finalize`, "POST", payload),

    hrAuditLog: (filters) => call("/hr/audit-log" + toQuery(filters), "GET"),

    notifications: (unreadOnly) => call("/notifications/me" + (unreadOnly ? "?unread=true" : ""), "GET"),
    markNotificationRead: (id) => call(`/notifications/${id}/read`, "POST"),

    oneOnOneSessions: () => call("/one-on-ones/sessions/me", "GET"),
    createOneOnOneSession: (payload) => call("/one-on-ones/sessions", "POST", payload),
    getOneOnOneSession: (id) => call(`/one-on-ones/sessions/${id}`, "GET"),
    updateOneOnOneAgenda: (id, sharedAgenda) => call(`/one-on-ones/sessions/${id}/agenda`, "PUT", { sharedAgenda }),
    updateOneOnOneNotes: (id, managerPrivateNotes) => call(`/one-on-ones/sessions/${id}/notes`, "PUT", { managerPrivateNotes }),
    completeOneOnOneSession: (id) => call(`/one-on-ones/sessions/${id}/complete`, "POST"),
    cancelOneOnOneSession: (id) => call(`/one-on-ones/sessions/${id}/cancel`, "POST"),
    createActionItem: (sessionId, payload) => call(`/one-on-ones/sessions/${sessionId}/action-items`, "POST", payload),
    updateActionItem: (sessionId, itemId, payload) => call(`/one-on-ones/sessions/${sessionId}/action-items/${itemId}`, "PATCH", payload),

    myAppraisals: () => call("/appraisals/me", "GET"),
    getAppraisal: (id) => call(`/appraisals/${id}`, "GET"),
    submitSelfReview: (id, payload) => call(`/appraisals/${id}/self-review`, "POST", payload),
    teamAppraisals: () => call("/appraisals/team", "GET"),
    submitManagerReview: (id, payload) => call(`/appraisals/${id}/manager-review`, "POST", payload),
    advanceAppraisalToCalibration: (id) => call(`/appraisals/${id}/advance-to-calibration`, "POST"),
    finalizeAppraisal: (id) => call(`/appraisals/${id}/finalize`, "POST"),
    returnAppraisalToManager: (id, reason) => call(`/appraisals/${id}/return-to-manager`, "POST", { reason }),
    reopenAppraisal: (id, reason) => call(`/appraisals/${id}/reopen`, "POST", { reason }),
    cancelAppraisal: (id) => call(`/appraisals/${id}/cancel`, "POST"),
    acknowledgeAppraisal: (id) => call(`/appraisals/${id}/acknowledge`, "POST"),
    calibrateAppraisal: (id, payload) => call(`/appraisals/${id}/calibrate`, "PATCH", payload),
    hrAppraisalCalibration: (cycleId) => call(`/hr/appraisal-cycles/${cycleId}/calibration`, "GET"),
    createAppraisalGoal: (payload) => call("/appraisals/goals", "POST", payload),
    updateAppraisalGoal: (id, payload) => call(`/appraisals/goals/${id}`, "PATCH", payload),

    hrAppraisalCycles: () => call("/hr/appraisal-cycles", "GET"),
    createAppraisalCycle: (payload) => call("/hr/appraisal-cycles", "POST", payload),
    openAppraisalCycle: (id) => call(`/hr/appraisal-cycles/${id}/open`, "POST"),
    closeAppraisalCycle: (id) => call(`/hr/appraisal-cycles/${id}/close`, "POST"),
    updateAppraisalCycleCategories: (cycleId, categories) => call(`/hr/appraisal-cycles/${cycleId}/categories`, "PUT", categories),
    hrAppraisalsForCycle: (cycleId) => call(`/hr/appraisal-cycles/${cycleId}/appraisals`, "GET"),
    importAppraisalRoster: (cycleId, rows) => call(`/hr/appraisal-cycles/${cycleId}/roster-import`, "POST", { rows }),
    hrAppraisalRatingValues: () => call("/hr/appraisal-rating-values", "GET"),
    createAppraisalRatingValue: (payload) => call("/hr/appraisal-rating-values", "POST", payload),
    hrAppraisalPerformanceLevels: () => call("/hr/appraisal-performance-levels", "GET"),
    updateAppraisalPerformanceLevels: (levels) => call("/hr/appraisal-performance-levels", "PUT", levels),
  };
})();
