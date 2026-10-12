# Frontend Flow

Screens, navigation, and the leave-request lifecycle for the static multi-page site described in `discussion.md`. Adapted from [`Reasoning/08-frontend-design.md`](../Reasoning/08-frontend-design.md)'s route table and [`Reasoning/04-workflow-state-machines.md`](../Reasoning/04-workflow-state-machines.md)'s state machine — one `.html` file per row instead of a client route, detail views take an `id` query param since there's no client-side router.

## Pages

| Page | Role | Purpose |
|---|---|---|
| `login.html` | public | Email + password. On success, backend sets the HttpOnly JWT cookie; page redirects to `dashboard.html` (or `change-password.html` if forced). |
| `change-password.html` | any, forced when `force_password_reset` | Blocks access to every other page (via `auth-guard.js`) until the password is changed. |
| `dashboard.html` | Employee | Balance summary cards (`leave-balance-card.js` × N) + recent request status list. |
| `leave-apply.html` | Employee | The leave application form (`leave-request-form.js`) — notice-period, balance-overflow, and LOP-eligibility warnings mirrored client-side per selected leave type. |
| `leave-history.html` | Employee | Own past/pending requests, list view with `status-badge.js` per row, links to `leave-view.html?id=`. |
| `leave-view.html?id=<id>` | Employee (own), Manager (if a direct report's), HR | Request detail + `approval-timeline.js`. Manager/HR approve/reject actions render here when the viewer is the current step's approver. No HR-override control yet (see `discussion.md` open items). |
| `profile.html` | Employee | Own profile, read-only except contact details (`employeeCode`/name/email/role) plus phone (+91, 10-digit) and address. |
| `manager-team-requests.html` | Manager (nav item shown only if `isManager`) | Direct reports roster + balances at a glance, plus the approval queue for their leave requests — links into `leave-view.html?id=`. |
| `hr-requests.html` | HR | Company-wide request queue, read-only list linking into `leave-view.html?id=`. |
| `hr-employees.html` | HR | Employee directory — **read-only list for now**; CRUD/impose-LOP controls not yet built (`createHrEmployee`/`updateHrEmployee`/`imposeLop` client methods exist, unused). |
| `hr-leave-types.html` | HR | Leave type catalog — name/code/entitlement/advance-notice/notes. Read-only; no approval-chain editor yet. |
| `hr-holidays.html` | HR | Public holiday calendar — **read-only**, split into "National (non-negotiable)" and "Other compulsory" tables. No create/delete UI yet. |
| `hr-lop-watchlist.html` | HR | Employees flagged by `LopReturnCheckJob`. |
| `hr-exit.html?employeeId=<id>` | HR | Exit settlement review (DRAFT) → finalize. **Not yet built** — `hrExit()`/`finalizeExit()` client methods exist and are wired, no page or sidebar link. |
| `hr-audit-log.html` | HR | Searchable audit trail. |
| `one-on-ones.html` | Employee, Manager | Own upcoming/past 1:1 sessions (both parties see the same list). |
| `one-on-one-view.html?id=<id>` | Employee, Manager | Shared agenda (either party edits), manager-only private notes (gated by `managerId === viewer.id`, not role), action items, complete/cancel. |
| `appraisals.html` | Employee | Own appraisal history across cycles. |
| `appraisal-view.html?id=<id>` | Employee (self-review), Manager (manager-review, revealed once self-review is submitted) | Rating + comments per step, goals list. |
| `manager-appraisals.html` | Manager | Team's reviews for the open cycle — links into `appraisal-view.html?id=`. |
| `hr-appraisal-cycles.html` | HR | Cycle config (create/open/close) + rating-scale editor. |

## Shell & navigation

Every authenticated page shares one header/sidebar, injected the same way as the reference stack (`components/header.html`, `components/sidebar.html` via a `loader.js`-style include — the footer partial was removed, see `discussion.md` §21). `js/auth-guard.js` runs first on every such page: resolves the session, hides content until resolved, redirects unauthenticated visitors to `login.html`, and (mechanism still in place, currently unused — see below) shows/hides nav sections by role:

```
Sidebar
├── Dashboard              (all)
├── Apply for Leave        (all)
├── My Requests            (all)
├── 1:1 Sessions           (all)
├── Appraisals             (all)
├── Profile                (all)
├── My Team                (intended: isManager only)
│   ├── Team               (roster + requests)
│   ├── Team One-on-Ones
│   └── Team Appraisals
└── HR Admin                (intended: role == HR only)
    ├── Requests
    ├── Employees
    ├── Leave Types
    ├── Holidays
    ├── LOP Watchlist
    ├── Audit Log
    └── Appraisal Cycles
```

**Role-gating is currently disabled** (`discussion.md` §17) — every section above renders for every signed-in user regardless of role, a deliberate dev-preview state, not the intended shipped behavior. `Exit Settlements` is absent from HR Admin because `hr-exit.html` doesn't exist yet (`discussion.md` open items).

`login.html` and `change-password.html` render standalone, outside this shell (matching the reference stack's treatment of its own auth pages).

## Employee flow

```
login.html
   │ (force_password_reset?) ──yes──▶ change-password.html ──▶ dashboard.html
   │ no
   ▼
dashboard.html ──▶ leave-apply.html ──submit──▶ leave-history.html
   │                                                  │
   │                                                  ▼
   └──────────────────────────────────────▶ leave-view.html?id=<id>
                                                  (status + approval-timeline)
```

## Manager flow (adds, on top of the employee flow above)

```
manager-team-requests.html (roster + balances, then requests) ──▶ leave-view.html?id=<id> ──approve/reject──▶ back to queue
```

## HR flow (adds, on top of the employee flow above)

```
hr-requests.html ──▶ leave-view.html?id=<id> ──approve/reject (HR step)──▶ back to queue
hr-employees.html  ──▶ read-only list (CRUD + impose-LOP not yet built, see discussion.md)
hr-leave-types.html, hr-holidays.html  ──▶ read-only config views, no request flow
hr-lop-watchlist.html ──▶ (drill-into-hr-employees.html not yet built)
hr-exit.html?employeeId=<id> ──▶ not yet built — client methods exist, no page
```

## One-on-One flow (per `16-module-one-on-one.md`; both parties see the same pages)

```
one-on-ones.html (own upcoming/past sessions) ──▶ one-on-one-view.html?id=<id>
                                                       │
                                    shared agenda (either party edits)
                                    private notes (manager_id === viewer only)
                                    action items (add / mark done)
                                    complete / cancel (either party, while SCHEDULED)
```

## Appraisal flow (per `17-module-appraisal.md`, extended by `Prompts/18-appraisal-enterprise-expansion.md`)

Cycle-level status (`DRAFT`/`OPEN`/`CLOSED`) and per-review status (below) are
separate fields - see `js/appraisal-status.js`.

```
appraisals.html (employee's own cycles) ──▶ appraisal-view.html?id=<id>
                                                 │
                                          SELF_APPRAISAL
                                                 │ employee submits self-review
                                                 ▼
                                          MANAGER_REVIEW (manager section now revealed)
                                                 │ manager submits manager-review
                                                 ▼
                                            HR_REVIEW ──return (reason req'd)──▶ RETURNED ──manager re-submits──┐
                                                 │ HR: Calibrate                                                 │
                                                 ▼                                                               │
                                           CALIBRATION ◀─────────────────────────────────────────────────────────┘
                                                 │ HR: Finalize
                                                 ▼
                                            FINALIZED ──employee: Acknowledge──▶ ACKNOWLEDGED ──cycle closed──▶ CLOSED
                                                 │
                                                 └──HR: Reopen (from FINALIZED/ACKNOWLEDGED/CLOSED)──▶ REOPENED ──HR: Re-finalize──▶ FINALIZED

CANCELLED - HR, from any non-terminal status above (terminal, no further transitions)
```

manager-appraisals.html (team queue, open cycle) ──▶ appraisal-view.html?id=<id>
hr-appraisal-cycles.html ──▶ create cycle (DRAFT) ──open──▶ OPEN ──close──▶ CLOSED
                          ──▶ rating-scale editor (value/label pairs)
                          ──▶ roster popup: per-row Calibrate/Return/Finalize/Reopen/Cancel actions

## Leave request lifecycle (drives `status-badge.js` and `approval-timeline.js`)

From `04-workflow-state-machines.md` — the UI never computes this, it only renders whatever `status` and `approvals[]` the API returns:

```
APPLIED ──▶ PENDING_MANAGER ──reject──▶ REJECTED
               │approve
               ▼
        (next step configured? e.g. Sabbatical/Maternity/Paternity/Marriage-edge/Exit)
               │yes                              │no (e.g. CL/PL)
               ▼                                  │
        PENDING_HR ──reject──▶ REJECTED     │
               │approve                           │
               └──────────────┬────────────────────┘
                               ▼
                            APPROVED
                               │
                     (paternity, unused, window closed — scheduled job only)
                               ▼
                            LAPSED

Cancel: allowed from APPLIED / PENDING_MANAGER / PENDING_HR only ──▶ CANCELLED
```

- **`status-badge.js` label/color mapping** (using the §4 palette from `discussion.md`): `APPLIED`/`PENDING_MANAGER`/`PENDING_HR` → warning amber; `APPROVED` → success green; `REJECTED` → danger red; `CANCELLED` → neutral gray; `LAPSED` → neutral gray with a distinct icon (color is never the only signal, per the accessibility rule).
- **`approval-timeline.js`** renders one step per row the API returns (1 row for CL/PL, 2 for Sabbatical/Maternity/Paternity/Marriage-edge/Exit) — pending/approved/rejected per step, generic enough that adding a leave type with a different chain length needs no frontend change.
- **HR-imposed LOP**: intended design — not created via `leave-apply.html`, but directly at `APPROVED` from `hr-employees.html` (no approval steps rendered, since none exist for this path). **Not yet built**: `imposeLop()` client method exists, no UI control calls it.
- **HR override/dispute**: intended design — not a distinct page, a direct status-change action available to HR from `leave-view.html?id=` when viewing any request, logged server-side to `hr-audit-log.html`. **Not yet built**: `overrideLeaveRequest()` client method exists, no UI control calls it.

## What each page's write actions map to

Every write goes through `js/api/api-client.js`, cookie-authenticated, server-reauthorized regardless of what the page shows (per `discussion.md` §5–6):

| Page action | API call (indicative — see `05-backend-api-design.md`) |
|---|---|
| Submit application | `POST /api/leave-requests` |
| Approve/reject step | `POST /api/leave-requests/{id}/action` |
| Cancel own request | `POST /api/leave-requests/{id}/cancel` |
| Impose LOP (not yet wired to a UI control) | `POST /api/hr/leave-requests/lop` |
| HR override (not yet wired to a UI control) | `POST /api/hr/leave-requests/{id}/override` |
| Update 1:1 agenda / private notes | `PUT /api/one-on-ones/sessions/{id}/agenda` / `/notes` |
| Complete / cancel 1:1 session | `POST /api/one-on-ones/sessions/{id}/complete` / `/cancel` |
| Add / update 1:1 action item | `POST` / `PATCH /api/one-on-ones/sessions/{id}/action-items[/{itemId}]` |
| Submit self-review / manager-review | `POST /api/appraisals/{id}/self-review` / `/manager-review` |
| Add / update appraisal goal | `POST /api/appraisals/goals` / `PATCH /api/appraisals/goals/{id}` |
| Create / open / close appraisal cycle | `POST /api/hr/appraisal-cycles` / `{id}/open` / `{id}/close` |
| Add rating-scale value | `POST /api/hr/appraisal-rating-values` |
