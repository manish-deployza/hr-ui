/* Real API client. Cookie-based auth (discussion.md #5) — never reads/stores
 * a token; the browser attaches the HttpOnly JWT cookie automatically. Page
 * scripts must call only these methods, never fetch() directly (rules
 * carried over from the reference stack, see rules.md there). */

const realApiClient = (function () {
  async function request(method, path, body) {
    const res = await fetch(path, {
      method: method,
      headers: body ? { "Content-Type": "application/json" } : {},
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !path.endsWith("/auth/me") && !path.endsWith("/auth/login")) {
      const returnTo = location.pathname + location.search;
      window.location.href = "login.html?redirect=" + encodeURIComponent(returnTo);
      return Promise.reject(new Error("Unauthorized"));
    }

    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : null;

    if (!res.ok) {
      const message = (data && data.message) || res.statusText || ("Request failed (" + res.status + ")");
      throw new Error(message);
    }
    return data;
  }

  return {
    login: (email, password) => request("POST", "/api/auth/login", { email, password }),
    changePassword: (currentPassword, newPassword) =>
      request("POST", "/api/auth/change-password", { currentPassword, newPassword }),
    me: () => request("GET", "/api/auth/me"),
    logout: () => request("POST", "/api/auth/logout"),

    myBalances: () => request("GET", "/api/leave-balances/me"),
    myRecentRequests: () => request("GET", "/api/leave-requests/me?recent=true"),
    myRequests: () => request("GET", "/api/leave-requests/me"),
    leaveTypes: () => request("GET", "/api/leave-types"),
    applyForLeave: (payload) => request("POST", "/api/leave-requests", payload),
    getLeaveRequest: (id) => request("GET", `/api/leave-requests/${id}`),
    actOnLeaveRequest: (id, action, comments) =>
      request("POST", `/api/leave-requests/${id}/action`, { action, comments }),
    cancelLeaveRequest: (id) => request("POST", `/api/leave-requests/${id}/cancel`),

    myProfile: () => request("GET", "/api/employees/me"),
    updateMyProfile: (payload) => request("PATCH", "/api/employees/me", payload),

    managerTeamRequests: () => request("GET", "/api/manager/leave-requests"),
    managerTeam: () => request("GET", "/api/manager/team"),

    hrRequests: (filters) => request("GET", "/api/hr/leave-requests" + toQuery(filters)),
    hrEmployees: (filters) => request("GET", "/api/hr/employees" + toQuery(filters)),
    getHrEmployee: (id) => request("GET", `/api/hr/employees/${id}`),
    createHrEmployee: (payload) => request("POST", "/api/hr/employees", payload),
    updateHrEmployee: (id, payload) => request("PATCH", `/api/hr/employees/${id}`, payload),
    reassignManager: (payload) => request("POST", "/api/hr/employees/reassign-manager", payload),
    imposeLop: (payload) => request("POST", "/api/hr/leave-requests/lop", payload),
    overrideLeaveRequest: (id, payload) => request("POST", `/api/hr/leave-requests/${id}/override`, payload),

    hrLeaveTypes: () => request("GET", "/api/hr/leave-types"),
    createHrLeaveType: (payload) => request("POST", "/api/hr/leave-types", payload),
    updateHrLeaveType: (id, payload) => request("PATCH", `/api/hr/leave-types/${id}`, payload),
    deleteHrLeaveType: (id) => request("DELETE", `/api/hr/leave-types/${id}`),

    hrHolidays: () => request("GET", "/api/hr/holidays"),
    createHrHoliday: (payload) => request("POST", "/api/hr/holidays", payload),
    deleteHrHoliday: (id) => request("DELETE", `/api/hr/holidays/${id}`),

    hrLopWatchlist: () => request("GET", "/api/hr/lop-watchlist"),

    hrExit: (employeeId) => request("GET", `/api/hr/exit/${employeeId}`),
    finalizeExit: (employeeId, payload) => request("POST", `/api/hr/exit/${employeeId}/finalize`, payload),

    hrAuditLog: (filters) => request("GET", "/api/hr/audit-log" + toQuery(filters)),

    notificationsUnread: () => request("GET", "/api/notifications/me?unread=true"),

    oneOnOneSessions: () => request("GET", "/api/one-on-ones/sessions/me"),
    createOneOnOneSession: (payload) => request("POST", "/api/one-on-ones/sessions", payload),
    getOneOnOneSession: (id) => request("GET", `/api/one-on-ones/sessions/${id}`),
    updateOneOnOneAgenda: (id, sharedAgenda) => request("PUT", `/api/one-on-ones/sessions/${id}/agenda`, { sharedAgenda }),
    updateOneOnOneNotes: (id, managerPrivateNotes) => request("PUT", `/api/one-on-ones/sessions/${id}/notes`, { managerPrivateNotes }),
    completeOneOnOneSession: (id) => request("POST", `/api/one-on-ones/sessions/${id}/complete`),
    cancelOneOnOneSession: (id) => request("POST", `/api/one-on-ones/sessions/${id}/cancel`),
    createActionItem: (sessionId, payload) => request("POST", `/api/one-on-ones/sessions/${sessionId}/action-items`, payload),
    updateActionItem: (sessionId, itemId, payload) => request("PATCH", `/api/one-on-ones/sessions/${sessionId}/action-items/${itemId}`, payload),

    myAppraisals: () => request("GET", "/api/appraisals/me"),
    getAppraisal: (id) => request("GET", `/api/appraisals/${id}`),
    submitSelfReview: (id, payload) => request("POST", `/api/appraisals/${id}/self-review`, payload),
    teamAppraisals: () => request("GET", "/api/appraisals/team"),
    submitManagerReview: (id, payload) => request("POST", `/api/appraisals/${id}/manager-review`, payload),
    createAppraisalGoal: (payload) => request("POST", "/api/appraisals/goals", payload),
    updateAppraisalGoal: (id, payload) => request("PATCH", `/api/appraisals/goals/${id}`, payload),

    hrAppraisalCycles: () => request("GET", "/api/hr/appraisal-cycles"),
    createAppraisalCycle: (payload) => request("POST", "/api/hr/appraisal-cycles", payload),
    openAppraisalCycle: (id) => request("POST", `/api/hr/appraisal-cycles/${id}/open`),
    closeAppraisalCycle: (id) => request("POST", `/api/hr/appraisal-cycles/${id}/close`),
    hrAppraisalRatingValues: () => request("GET", "/api/hr/appraisal-rating-values"),
    createAppraisalRatingValue: (payload) => request("POST", "/api/hr/appraisal-rating-values", payload),
  };

  function toQuery(filters) {
    if (!filters) return "";
    const params = new URLSearchParams(filters);
    const str = params.toString();
    return str ? "?" + str : "";
  }
})();
