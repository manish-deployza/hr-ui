/* Mock API client — same method signatures as api-client.js, returns static
 * fixtures so screens can be built before the backend endpoint exists (see
 * discussion.md #8). Mutations don't persist across calls. Shaped after
 * Reasoning/02-database-schema.md's employee/leave_type/leave_request/
 * leave_ledger_entry/notification/audit_log/public_holiday tables. */

const mockApiClient = (function () {
  const delay = (data) => new Promise((resolve) => setTimeout(() => resolve(data), 150));

  // Dev-only override so the role-gated nav (e.g. sidebar's HR Admin
  // section) can be previewed without a real HR_ADMIN login: append
  // ?role=HR_ADMIN to any page URL.
  const mockRole = new URLSearchParams(location.search).get("role") || "EMPLOYEE";

  // Org roster (employee table). manager_id drives "my team"/HR views —
  // Jordan manages Alex and Priya; Sam is HR with no reports.
  const employees = [
    { id: 1, employeeCode: "DPZ-0142", name: "Jordan Lee", email: "jordan.lee@example.com", phone: "9876543210", address: "", role: mockRole, managerId: null, department: "Engineering", designation: "Engineering Manager", employeeType: "REGULAR", dateOfJoining: "2021-03-15", dateOfExit: null, basicSalary: 185000, status: "ACTIVE" },
    { id: 2, employeeCode: "DPZ-0198", name: "Alex Kim", email: "alex.kim@example.com", phone: "9876500002", address: "", role: "EMPLOYEE", managerId: 1, department: "Engineering", designation: "Software Engineer", employeeType: "REGULAR", dateOfJoining: "2023-01-10", dateOfExit: null, basicSalary: 92000, status: "ACTIVE" },
    { id: 3, employeeCode: "DPZ-0205", name: "Priya Sharma", email: "priya.sharma@example.com", phone: "9876500003", address: "", role: "EMPLOYEE", managerId: 1, department: "Engineering", designation: "QA Engineer", employeeType: "REGULAR", dateOfJoining: "2022-07-01", dateOfExit: null, basicSalary: 78000, status: "ACTIVE" },
    { id: 4, employeeCode: "DPZ-0110", name: "Sam Rivera", email: "sam.rivera@example.com", phone: "9876500004", address: "", role: "HR_ADMIN", managerId: null, department: "People Ops", designation: "HR Administrator", employeeType: "REGULAR", dateOfJoining: "2020-05-20", dateOfExit: null, basicSalary: 110000, status: "ACTIVE" },
  ];

  // isManager is derived (someone's manager_id points at you), not a stored
  // column — every employee below happens to have 0 reports except Jordan.
  const myManager = employees.find((e) => e.id === employees[0].managerId);
  const me = Object.assign({}, employees[0], { isManager: true, managerName: myManager ? myManager.name : null, forcePasswordReset: false });

  // Catalog per Reasoning/03-leave-policy-engine.md's leave type table —
  // PUBLIC_HOLIDAY (calendar-driven, not applied for) and INTERN_STUDY
  // (this sample employee is REGULAR) are excluded, matching what the real
  // /api/leave-types endpoint should return for this employee.
  const leaveTypes = [
    { id: 1, name: "Casual Leave", code: "CL", daysPerYear: "14 days/year", infoNote: "Includes sick leave. CL + PL = 24 days." },
    { id: 2, name: "Privilege Leave", code: "PL", daysPerYear: "10 days/year", infoNote: "0.8 day/month, credited quarterly (Jan/Apr/Jul/Sep). Carry-forward capped at 5 days." },
    { id: 3, name: "Optional Holiday", code: "OPTIONAL_HOLIDAY", daysPerYear: "2 days/year", infoNote: "Floating holiday for festivals not on the org calendar." },
    { id: 4, name: "Marriage Leave", code: "MARRIAGE", daysPerYear: "5 days", requiresAdvanceNoticeDays: 30, infoNote: "Flat 5 days." },
    { id: 5, name: "Maternity Leave", code: "MATERNITY", daysPerYear: "Up to 26 weeks", requiresAdvanceNoticeDays: 30, requiresSituationType: true, infoNote: "Duration depends on situation type." },
    { id: 6, name: "Paternity Leave", code: "PATERNITY", daysPerYear: "15 days", requiresAdvanceNoticeDays: 30, infoNote: "Flat 15 calendar days." },
    { id: 7, name: "Sabbatical", code: "SABBATICAL", daysPerYear: "1 month", infoNote: "1 month, unpaid. Requires Manager and HR approval." },
    { id: 8, name: "Loss of Pay", code: "LOP", daysPerYear: "Up to 15 days/year", infoNote: "Only available once Casual Leave and Privilege Leave balances are both exhausted. Capped at 15 working days/year." },
  ];

  // HR's own catalog view is the full org-wide list (leave_type table has
  // no per-employee filter) — includes the two codes hidden from the
  // employee-facing leaveTypes() above.
  const hrLeaveTypesCatalog = leaveTypes.concat([
    { id: 9, name: "Intern Study Leave", code: "INTERN_STUDY", daysPerYear: "Per policy", infoNote: "Applicable to interns only (employee_type = INTERN)." },
    { id: 10, name: "Public Holiday", code: "PUBLIC_HOLIDAY", daysPerYear: "Calendar-driven", infoNote: "Not applied for — driven by the organization's holiday calendar (see public_holiday table)." },
  ]);

  // Current balance per (employee, leave_type) = SUM(leave_ledger_entry.amount_days)
  // for the year — this is that computed view, not the raw ledger. Alex is
  // CL/PL-exhausted, which is why the LOP request below was eligible/imposed.
  const balancesByEmployee = {
    1: [
      { leaveTypeId: 1, leaveTypeCode: "CL", leaveTypeName: "Casual Leave", balance: 6 },
      { leaveTypeId: 2, leaveTypeCode: "PL", leaveTypeName: "Privilege Leave", balance: 9.6 },
      { leaveTypeId: 3, leaveTypeCode: "OPTIONAL_HOLIDAY", leaveTypeName: "Optional Holiday", balance: 1 },
    ],
    2: [
      { leaveTypeId: 1, leaveTypeCode: "CL", leaveTypeName: "Casual Leave", balance: 0 },
      { leaveTypeId: 2, leaveTypeCode: "PL", leaveTypeName: "Privilege Leave", balance: 0 },
      { leaveTypeId: 3, leaveTypeCode: "OPTIONAL_HOLIDAY", leaveTypeName: "Optional Holiday", balance: 2 },
    ],
    3: [
      { leaveTypeId: 1, leaveTypeCode: "CL", leaveTypeName: "Casual Leave", balance: 9 },
      { leaveTypeId: 2, leaveTypeCode: "PL", leaveTypeName: "Privilege Leave", balance: 6.4 },
      { leaveTypeId: 3, leaveTypeCode: "OPTIONAL_HOLIDAY", leaveTypeName: "Optional Holiday", balance: 2 },
    ],
  };

  // leave_request + leave_request_approval, one flat list all the derived
  // endpoints below filter/sort from — single source of truth so
  // myRequests/managerTeamRequests/hrRequests/getLeaveRequest can never
  // disagree with each other about what a given id looks like.
  const allLeaveRequests = [
    {
      id: 95, employeeId: 1, employeeName: "Jordan Lee", leaveTypeId: 7, leaveTypeCode: "SABBATICAL", leaveTypeName: "Sabbatical",
      startDate: "2026-10-01", endDate: "2026-10-31", numDays: 31, status: "PENDING_HR_ADMIN", reason: "Writing a book on distributed systems",
      approvals: [
        { stepOrder: 1, approverRole: "MANAGER", approverEmployeeId: 1, action: "APPROVED", comments: "Approved as self-manager per handbook §4.", actedAt: "2026-08-10T10:00:00" },
        { stepOrder: 2, approverRole: "HR_ADMIN", approverEmployeeId: null, action: "PENDING" },
      ],
    },
    {
      id: 96, employeeId: 1, employeeName: "Jordan Lee", leaveTypeId: 4, leaveTypeCode: "MARRIAGE", leaveTypeName: "Marriage Leave",
      startDate: "2026-11-20", endDate: "2026-11-24", numDays: 5, status: "PENDING_MANAGER", reason: "Wedding",
      approvals: [{ stepOrder: 1, approverRole: "MANAGER", approverEmployeeId: null, action: "PENDING" }],
    },
    {
      id: 97, employeeId: 1, employeeName: "Jordan Lee", leaveTypeId: 2, leaveTypeCode: "PL", leaveTypeName: "Privilege Leave",
      startDate: "2026-03-10", endDate: "2026-03-11", numDays: 2, status: "LAPSED", reason: "Sister's function",
      approvals: [{ stepOrder: 1, approverRole: "MANAGER", approverEmployeeId: null, action: "PENDING" }],
    },
    {
      id: 98, employeeId: 1, employeeName: "Jordan Lee", leaveTypeId: 3, leaveTypeCode: "OPTIONAL_HOLIDAY", leaveTypeName: "Optional Holiday",
      startDate: "2026-05-01", endDate: "2026-05-01", numDays: 1, status: "CANCELLED", reason: "Local festival",
      approvals: [{ stepOrder: 1, approverRole: "MANAGER", approverEmployeeId: 4, action: "APPROVED", actedAt: "2026-04-20T09:00:00" }],
      cancelledAt: "2026-04-25T08:00:00",
    },
    {
      id: 99, employeeId: 1, employeeName: "Jordan Lee", leaveTypeId: 1, leaveTypeCode: "CL", leaveTypeName: "Casual Leave",
      startDate: "2026-06-02", endDate: "2026-06-02", numDays: 1, status: "REJECTED", reason: "Personal errand",
      approvals: [{ stepOrder: 1, approverRole: "MANAGER", approverEmployeeId: 4, action: "REJECTED", comments: "Critical release week, please reschedule.", actedAt: "2026-06-01T10:00:00" }],
    },
    {
      id: 100, employeeId: 1, employeeName: "Jordan Lee", leaveTypeId: 2, leaveTypeCode: "PL", leaveTypeName: "Privilege Leave",
      startDate: "2026-07-10", endDate: "2026-07-12", numDays: 3, status: "APPROVED", reason: "Family trip",
      approvals: [
        { stepOrder: 1, approverRole: "MANAGER", approverEmployeeId: 4, action: "APPROVED", actedAt: "2026-07-08T12:00:00" },
        { stepOrder: 2, approverRole: "HR_ADMIN", approverEmployeeId: 4, action: "APPROVED", actedAt: "2026-07-09T15:00:00" },
      ],
    },
    {
      id: 101, employeeId: 1, employeeName: "Jordan Lee", leaveTypeId: 1, leaveTypeCode: "CL", leaveTypeName: "Casual Leave",
      startDate: "2026-08-25", endDate: "2026-08-26", numDays: 2, status: "PENDING_MANAGER", reason: "Family function",
      approvals: [{ stepOrder: 1, approverRole: "MANAGER", approverEmployeeId: null, action: "PENDING" }],
    },
    {
      id: 102, employeeId: 2, employeeName: "Alex Kim", leaveTypeId: 1, leaveTypeCode: "CL", leaveTypeName: "Casual Leave",
      startDate: "2026-08-21", endDate: "2026-08-21", numDays: 1, status: "PENDING_MANAGER", reason: "Dentist appointment",
      approvals: [{ stepOrder: 1, approverRole: "MANAGER", approverEmployeeId: null, action: "PENDING" }],
    },
    {
      id: 103, employeeId: 2, employeeName: "Alex Kim", leaveTypeId: 8, leaveTypeCode: "LOP", leaveTypeName: "Loss of Pay",
      startDate: "2026-07-20", endDate: "2026-08-07", numDays: 15, status: "APPROVED", reason: "—", isHrImposed: true,
      hrNotes: "Imposed after CL/PL balances were exhausted; no return-from-leave application filed within the required window.",
      approvals: [{ stepOrder: 1, approverRole: "HR_ADMIN", approverEmployeeId: 4, action: "APPROVED", comments: "HR-imposed LOP per policy.", actedAt: "2026-07-20T09:00:00" }],
    },
    {
      id: 104, employeeId: 3, employeeName: "Priya Sharma", leaveTypeId: 2, leaveTypeCode: "PL", leaveTypeName: "Privilege Leave",
      startDate: "2026-04-15", endDate: "2026-04-16", numDays: 2, status: "APPROVED", reason: "Cousin's wedding",
      approvals: [
        { stepOrder: 1, approverRole: "MANAGER", approverEmployeeId: 1, action: "APPROVED", actedAt: "2026-04-10T09:00:00" },
        { stepOrder: 2, approverRole: "HR_ADMIN", approverEmployeeId: 4, action: "APPROVED", actedAt: "2026-04-11T09:00:00" },
      ],
    },
    {
      id: 105, employeeId: 3, employeeName: "Priya Sharma", leaveTypeId: 5, leaveTypeCode: "MATERNITY", leaveTypeName: "Maternity Leave",
      startDate: "2026-09-01", endDate: "2027-03-01", numDays: 182, status: "PENDING_HR_ADMIN", reason: "Maternity leave", situationType: "UP_TO_2_CHILDREN",
      approvals: [
        { stepOrder: 1, approverRole: "MANAGER", approverEmployeeId: 1, action: "APPROVED", actedAt: "2026-07-25T09:00:00" },
        { stepOrder: 2, approverRole: "HR_ADMIN", approverEmployeeId: null, action: "PENDING" },
      ],
    },
    {
      // Spans "today" in this app's fixed demo clock (2026-08-20) — the row
      // that makes the "who's on leave right now" section non-empty.
      id: 106, employeeId: 2, employeeName: "Alex Kim", leaveTypeId: 1, leaveTypeCode: "CL", leaveTypeName: "Casual Leave",
      startDate: "2026-08-19", endDate: "2026-08-21", numDays: 3, status: "APPROVED", reason: "Family visit",
      approvals: [{ stepOrder: 1, approverRole: "MANAGER", approverEmployeeId: 1, action: "APPROVED", actedAt: "2026-08-15T09:00:00" }],
    },
  ];

  function requestsFor(employeeId) {
    return allLeaveRequests.filter((r) => r.employeeId === employeeId).slice().sort((a, b) => b.id - a.id);
  }
  function toSummaryRow(r) {
    return { id: r.id, employeeName: r.employeeName, leaveTypeName: r.leaveTypeName, startDate: r.startDate, endDate: r.endDate, status: r.status };
  }

  // notification table — only .length is read today (js/notification-bell.js),
  // but the shape mirrors the real columns.
  const notificationsByEmployee = {
    1: [
      { id: 1, type: "LEAVE_APPROVED", title: "Leave approved", message: "Your Privilege Leave request (Jul 10 – Jul 12) was approved.", relatedEntityType: "LEAVE_REQUEST", relatedEntityId: 100, isRead: false, createdAt: "2026-07-09T15:05:00" },
      { id: 2, type: "LEAVE_APPLIED", title: "Team request awaiting you", message: "Alex Kim applied for Casual Leave (Aug 21).", relatedEntityType: "LEAVE_REQUEST", relatedEntityId: 102, isRead: false, createdAt: "2026-08-18T11:20:00" },
    ],
  };

  // One-on-One fixtures (Reasoning/16-module-one-on-one.md). `me` (id 1) is
  // the manager on session 201, so the private-notes panel and complete/
  // cancel actions are visible on that session — mirrors the doc's
  // manager_id-ownership access rule, not a role check.
  const oneOnOneSessionList = [
    { id: 201, managerId: 1, employeeId: 2, otherPartyName: "Alex Kim", scheduledAt: "2026-08-22T15:00:00", status: "SCHEDULED" },
    { id: 200, managerId: 1, employeeId: 2, otherPartyName: "Alex Kim", scheduledAt: "2026-08-08T15:00:00", status: "COMPLETED" },
  ];

  const oneOnOneSessionDetail = {
    id: 201,
    managerId: 1,
    employeeId: 2,
    otherPartyName: "Alex Kim",
    scheduledAt: "2026-08-22T15:00:00",
    status: "SCHEDULED",
    sharedAgenda: "Discuss Q3 goals progress.",
    managerPrivateNotes: "Doing well, consider for the stretch project.",
    actionItems: [
      { id: 301, description: "Send updated project doc", ownerEmployeeId: 2, dueDate: "2026-08-25", status: "OPEN" },
    ],
  };

  // Appraisal fixtures (Reasoning/17-module-appraisal.md).
  const appraisalRatingValues = [
    { id: 1, value: 1, label: "Needs Improvement", sortOrder: 1 },
    { id: 2, value: 2, label: "Meets Expectations", sortOrder: 2 },
    { id: 3, value: 3, label: "Exceeds Expectations", sortOrder: 3 },
    { id: 4, value: 4, label: "Outstanding", sortOrder: 4 },
  ];

  const myAppraisalsList = [
    { id: 401, cycleName: "H1 2026", status: "MANAGER_PENDING", selfRatingLabel: "Exceeds Expectations", managerRatingLabel: null },
  ];

  // Keyed by id — unlike getOneOnOneSession(), getAppraisal(id) actually
  // differentiates, since both "my own appraisal" (401, self-reviewed,
  // awaiting Jordan's own manager) and "a report's appraisal" (402, Alex
  // Kim, awaiting Jordan's manager review) need to be independently
  // reachable — manager-appraisals.html links straight to ?id=402.
  const appraisalDetailsById = {
    401: {
      id: 401,
      cycleId: 1,
      cycleName: "H1 2026",
      employeeId: 1,
      managerId: null,
      status: "MANAGER_PENDING",
      selfRatingValueId: 3,
      selfComments: "Shipped the leave management MVP ahead of schedule.",
      managerRatingValueId: null,
      managerComments: null,
      managerCategories: [],
      ratingValues: appraisalRatingValues,
      goals: [
        { id: 501, description: "Ship leave management MVP", status: "ACHIEVED" },
        { id: 502, description: "Mentor new hire", status: "IN_PROGRESS" },
      ],
    },
    402: {
      id: 402,
      cycleId: 1,
      cycleName: "H1 2026",
      employeeId: 2,
      managerId: 1,
      status: "MANAGER_PENDING",
      selfRatingValueId: 2,
      selfComments: "Shipped the CSV bulk-upload and reassignment tooling this half.",
      managerRatingValueId: null,
      managerComments: null,
      managerCategories: [],
      ratingValues: appraisalRatingValues,
      goals: [{ id: 511, description: "Own the HR employee-admin screens", status: "IN_PROGRESS" }],
    },
  };

  const teamAppraisalsList = [{ id: 402, managerId: 1, employeeId: 2, employeeName: "Alex Kim", cycleName: "H1 2026", status: "MANAGER_PENDING" }];

  const appraisalCycles = [
    { id: 1, name: "H1 2026", startDate: "2026-01-01", endDate: "2026-06-30", selfReviewDeadline: "2026-07-05", managerReviewDeadline: "2026-07-20", status: "OPEN" },
  ];

  return {
    login: () => delay({ ok: true }),
    changePassword: () => delay({ ok: true }),
    me: () => delay(me),
    logout: () => delay({ ok: true }),

    myBalances: () => delay(balancesByEmployee[me.id] || []),
    myRecentRequests: () => delay(requestsFor(me.id).slice(0, 3).map(toSummaryRow)),
    myRequests: () => delay(requestsFor(me.id).map(toSummaryRow)),
    leaveTypes: () => delay(leaveTypes),
    applyForLeave: () => delay({ id: 110, status: "APPLIED" }),
    getLeaveRequest: (id) => {
      const r = allLeaveRequests.find((x) => String(x.id) === String(id));
      return r ? delay(r) : Promise.reject(new Error("Leave request not found."));
    },
    actOnLeaveRequest: () => delay({ ok: true }),
    cancelLeaveRequest: () => delay({ ok: true }),

    myProfile: () => delay(me),
    updateMyProfile: () => delay({ ok: true }),

    managerTeamRequests: () => {
      const reportIds = employees.filter((e) => e.managerId === me.id).map((e) => e.id);
      const rows = allLeaveRequests.filter((r) => reportIds.indexOf(r.employeeId) !== -1).slice().sort((a, b) => b.id - a.id).map(toSummaryRow);
      return delay(rows);
    },
    managerTeam: () =>
      delay(
        // No 1:1 session in oneOnOneSessionList for Priya — demonstrates the
        // "needs scheduling" case on manager-one-on-ones.html.
        employees
          .filter((e) => e.managerId === me.id)
          .map((e) => ({ id: e.id, name: e.name, balances: balancesByEmployee[e.id] || [] }))
      ),

    hrRequests: () => delay(allLeaveRequests.slice().sort((a, b) => b.id - a.id).map(toSummaryRow)),
    hrEmployees: () => delay(employees.map((e) => Object.assign({}, e))),
    getHrEmployee: (id) => delay(employees.find((e) => e.id === Number(id)) || null),
    createHrEmployee: () => delay({ id: 5 }),
    updateHrEmployee: () => delay({ ok: true }),
    // One call, not one PATCH per employee — this is a single service-layer
    // transaction on the real backend (employee.manager_id, plus every
    // still-open one_on_one_series/session and non-FINALIZED
    // appraisal_review for these employees moves to the new manager).
    // FINALIZED appraisals and COMPLETED/CANCELLED sessions are untouched —
    // they're historical record of what the outgoing manager actually
    // decided, not open state to hand off (17-module-appraisal.md's
    // "manager changes mid-cycle" question resolved the other way: this app
    // transfers in-flight work to the new manager rather than leaving it
    // with the outgoing one).
    reassignManager: () => delay({ ok: true }),
    imposeLop: () => delay({ id: 103, status: "APPROVED" }),
    overrideLeaveRequest: () => delay({ ok: true }),

    hrLeaveTypes: () => delay(hrLeaveTypesCatalog),
    createHrLeaveType: () => delay({ id: hrLeaveTypesCatalog.length + 1 }),
    updateHrLeaveType: () => delay({ ok: true }),
    deleteHrLeaveType: () => delay({ ok: true }),

    // 8 compulsory public holidays for 2026 + 2 floating optional days = 10
    // total, matching Reasoning/11-policy-source-reference.md's "Public
    // Holidays (10)". Picked from the gazetted 2026 holiday list: Republic
    // Day, Independence Day, and Gandhi Jayanti are the 3 non-negotiable
    // national holidays; the other 5 are chosen by weekend/priority. The 2
    // optional days aren't fixed calendar dates — see the OPTIONAL_HOLIDAY
    // leave type instead.
    hrHolidays: () =>
      delay([
        { id: 1, name: "Republic Day", date: "2026-01-26", year: 2026, nonNegotiable: true },
        { id: 2, name: "Cheti Chand", date: "2026-03-20", year: 2026 },
        { id: 3, name: "Ram Navami", date: "2026-03-27", year: 2026 },
        { id: 4, name: "Good Friday", date: "2026-04-03", year: 2026 },
        { id: 5, name: "Buddha Purnima", date: "2026-05-01", year: 2026 },
        { id: 6, name: "Muharram", date: "2026-06-26", year: 2026 },
        { id: 7, name: "Independence Day", date: "2026-08-15", year: 2026, nonNegotiable: true },
        { id: 8, name: "Gandhi Jayanti", date: "2026-10-02", year: 2026, nonNegotiable: true },
      ]),
    createHrHoliday: () => delay({ ok: true }),
    deleteHrHoliday: () => delay({ ok: true }),

    // LopReturnCheckJob flags an employee once their approved 15-working-day
    // LOP block has ended with no return record (03-leave-policy-engine.md).
    // Kept in sync with request #103 above rather than duplicated by hand.
    hrLopWatchlist: () => {
      const flags = allLeaveRequests
        .filter((r) => r.leaveTypeCode === "LOP" && r.isHrImposed)
        .map((r) => ({ employeeName: r.employeeName, lopStartDate: r.startDate, lopEndDate: r.endDate, flaggedAt: "2026-08-08" }));
      return delay(flags);
    },

    hrExit: () => delay({ employeeId: 2, status: "DRAFT" }),
    finalizeExit: () => delay({ ok: true }),

    // Hand-written at the sensitive mutation points 02-database-schema.md
    // names: HR override, imposed LOP, exit finalize, leave-type config
    // changes. entityId 103/99 line up with the leave requests above.
    hrAuditLog: () =>
      delay([
        { entityType: "LEAVE_REQUEST", entityId: 103, action: "LOP_IMPOSED", performedByName: "Sam Rivera", createdAt: "2026-07-20T09:00:00" },
        { entityType: "LEAVE_TYPE", entityId: 2, action: "LEAVE_TYPE_UPDATED", performedByName: "Sam Rivera", createdAt: "2026-07-15T14:30:00" },
        { entityType: "LEAVE_REQUEST", entityId: 99, action: "HR_OVERRIDE", performedByName: "Sam Rivera", createdAt: "2026-06-03T11:00:00" },
        { entityType: "EXIT_SETTLEMENT", entityId: 1, action: "EXIT_FINALIZED", performedByName: "Sam Rivera", createdAt: "2026-06-01T16:45:00" },
      ]),

    notificationsUnread: () => delay((notificationsByEmployee[me.id] || []).filter((n) => !n.isRead)),

    oneOnOneSessions: () => delay(oneOnOneSessionList),
    createOneOnOneSession: () => delay({ id: 202 }),
    getOneOnOneSession: () => delay(oneOnOneSessionDetail),
    updateOneOnOneAgenda: () => delay({ ok: true }),
    updateOneOnOneNotes: () => delay({ ok: true }),
    completeOneOnOneSession: () => delay({ ok: true }),
    cancelOneOnOneSession: () => delay({ ok: true }),
    createActionItem: () => delay({ id: 302 }),
    updateActionItem: () => delay({ ok: true }),

    myAppraisals: () => delay(myAppraisalsList),
    getAppraisal: (id) => delay(appraisalDetailsById[Number(id)] || appraisalDetailsById[401]),
    submitSelfReview: () => delay({ ok: true }),
    teamAppraisals: () => delay(teamAppraisalsList),
    submitManagerReview: () => delay({ ok: true }),
    createAppraisalGoal: () => delay({ id: 503 }),
    updateAppraisalGoal: () => delay({ ok: true }),

    hrAppraisalCycles: () => delay(appraisalCycles),
    createAppraisalCycle: () => delay({ id: 2 }),
    openAppraisalCycle: () => delay({ ok: true }),
    closeAppraisalCycle: () => delay({ ok: true }),
    hrAppraisalRatingValues: () => delay(appraisalRatingValues),
    createAppraisalRatingValue: () => delay({ id: 5 }),
  };
})();
