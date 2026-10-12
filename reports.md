# API Endpoint Check — Live Backend vs. Frontend Contract

**Run:** 2026-08-31 · check only · full authenticated sweep re-run after team shipped notes

## Re-sweep result (authenticated, session = ORG_ADMIN)

Only **9** endpoints are reachable on the running backend (`:8082`, PID 16356). Every
one is **already wired into the frontend** — nothing to "insert". `400` below = route
exists, rejected the empty `{}` test body (works with a real payload).

| Method | Path | Status | Frontend caller (already wired) |
|---|---|---|---|
| POST | `/auth/login` | 400→ok | `login.html` |
| POST | `/auth/logout` | 200 | `apiClient.logout` (no UI button — by design) |
| POST | `/auth/change-password` | 400→ok | `change-password.html`, `settings.html` |
| POST | `/auth/signup` | 400→ok | `signup.html` (direct fetch) |
| GET | `/auth/me` | 200 | `auth-guard.js` |
| GET | `/employees/me` | 200 | `profile.js` |
| PATCH | `/employees/me` | 200 | `profile.js` |
| GET | `/organization` | 200 | `settings.js` |
| PATCH | `/organization` | 200 | `settings.js` |

**All other 65 endpoints → `404`.** The `GET/POST/PATCH/DELETE /api/hr/employees`
spec the team circulated is **NOT deployed** on the running backend — all four still
`404`, as does `/hr/employees/reassign-manager`. Backend needs a rebuild/redeploy
before any HR-employees UI can work.

**Nothing was changed in the frontend** — the precondition "status 200 → wire it up"
matched no unwired endpoint. The frontend already calls every implemented route.

---

**Frontend:** http://localhost:8080 (static, Jetty) · `config.json` → `mockMode: false`, `apiBaseUrl: http://localhost:8082/api`
**Backend:** http://localhost:8082/api (Spring on Jetty 12.0.19)
**Session used:** org `deploy-1` / `deploy@1.com` · JWT role `ORG_ADMIN` · orgId 605 · employee id 704
**Endpoint list:** every method in `js/api-client.js` plus the pasted auth table (~74 routes)

## Authoritative backend surface (confirmed by the team)

The backend currently implements **exactly these**, and nothing else:

| # | Method | Path | Body | Notes |
|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | `{orgUsername, email, password}` | sets `session_token` cookie |
| 2 | GET | `/api/auth/me` | — | full SessionData |
| 3 | POST | `/api/auth/change-password` | `{currentPassword, newPassword}` | cookie required |
| 4 | POST | `/api/auth/logout` | — | clears cookie |
| 5 | GET | `/api/employees/me` | — | same shape as `/auth/me` |
| 6 | PATCH | `/api/employees/me` | `{phone, address}` | null field = leave unchanged; >255 chars → 400 |
| 7 | POST | `/api/auth/signup` | `{orgUsername, email, password}` | creates a new org + ORG_ADMIN, not an employee |

Probe also found **`GET` / `PATCH /api/organization`** responding `200` with real data
(`{id, name, username, hrNotifyEmail, status}`) — used by `settings.html`. Not on the
team's list of 7; either an extra route or served by another module. Everything else
(~66 routes: all leave, manager, HR-admin, notifications, one-on-ones, appraisals)
returns `404`.

## Method / how to read the results

The auth filter returns `401` for **any** path without a valid session — including paths
that don't exist — so the unauthenticated probe only proves "filter is on", not "route
exists". The real signal is the **authenticated** sweep: with a valid cookie, an
implemented route responds with data or a business error; an unimplemented one returns
`404 {"summary":"Not found"}`.

---

## Status summary

| | Count | Endpoints |
|---|---|---|
| ✅ Implemented | 9 | `/auth/*` (login, me, change-password, logout, **signup**), `/employees/me` (GET+PATCH), `/organization` (GET+PATCH) |
| ❌ Not implemented (`404`) | ~66 | **all** of leave, manager, HR-admin, notifications, one-on-ones, appraisals |

Backend currently covers **auth + session + org profile only**. The frontend is built
against the full contract; every feature module past login will fail on load.

---

## Implemented endpoints — detail

| Method | Path | HTTP | Feedback |
|---|---|---|---|
| POST | `/auth/login` | 200 | Returns `{}` + `Set-Cookie: session_token=<JWT>` — HS256, `HttpOnly`, `Path=/`, `Max-Age=3600`. No `Secure` / no `SameSite` attr (fine on localhost; set for HTTPS prod). Missing field → `400 {"summary":"organization username is required"}`. Wrong password → `401 {"summary":"Invalid credentials"}` — generic, no account-enumeration leak. **JWT `role` claim = `ORG_ADMIN`** (see divergence #1). |
| POST | `/auth/logout` | 200 | Returns `{}`. **No auth check** — returns 200 even with no session cookie. Harmless (idempotent) but inconsistent. |
| GET | `/auth/me` | 200 | Session object. **Missing `forcePasswordReset`** (divergence #2). Extra field `organizationUsername` (not in contract). `role: "ORG_ADMIN"`. `name: null` for this admin account. All other contract fields present. |
| GET | `/employees/me` | 200 | Byte-identical shape to `/auth/me` — same missing `forcePasswordReset`, same `ORG_ADMIN`. Matches contract's "identical shape" note. |
| PATCH | `/employees/me` | 200 / 400 | `{}` → `200` with the **full session object** (contract says response is `{}`). Body with unknown keys (`role`, `name`, `email`, `basicSalary`) → `400 {"summary":"Malformed request body"}` — strict DTO, so over-posting is blocked server-side. Not exercised with a real `{phone, address}` write (no state change wanted). |
| POST | `/auth/change-password` | 400 | Wrong current password → `400 {"summary":"current password is incorrect"}`. Not run to success (would change the only known password). |
| POST | `/auth/signup` | 400 | Exists (empty body → `400 {"summary":"Malformed request body"}`). Creates a new org + its ORG_ADMIN — **not** an employee. Wired to `signup.html`. Not run to success (would create an org). |
| GET | `/organization` | 200 | `{id, name, username, hrNotifyEmail, status}`. **Undocumented** — `api-client.js` has `organization()` and `settings.html` uses it, but it's absent from `API-REQUIREMENTS.md` (divergence #6). |
| PATCH | `/organization` | 200 | Echoes the org object. `{}` = no-op. Same undocumented status. |

---

## Not implemented — all return `404 {"summary":"Not found"}`

**Leave (employee):** `/leave-types` · `/leave-balances/me` · `/leave-requests/me` (+`?recent=true`) · `POST /leave-requests` · `/leave-requests/{id}` · `/leave-requests/{id}/action` · `/leave-requests/{id}/cancel`

**Manager:** `/manager/team` · `/manager/leave-requests`

**HR — leave & employees:** `/hr/leave-requests` · `/hr/employees` (GET, POST) · `/hr/employees/{id}` (GET, PATCH) · `/hr/employees/reassign-manager` · `/hr/leave-requests/lop` · `/hr/leave-requests/{id}/override` · `/hr/leave-types` (GET, POST, PATCH, DELETE) · `/hr/holidays` (GET, POST, DELETE) · `/hr/lop-watchlist` · `/hr/exit/{id}` (GET, finalize) · `/hr/audit-log`

**Notifications:** `/notifications/me` (+`?unread=true`)

**One-on-Ones:** `/one-on-ones/sessions/me` · `POST /one-on-ones/sessions` · `/one-on-ones/sessions/{id}` · `/agenda` · `/notes` · `/complete` · `/cancel` · `/action-items` (POST, PATCH)

**Appraisals:** `/appraisals/me` · `/appraisals/{id}` · `/self-review` · `/appraisals/team` · `/manager-review` · `/advance-to-calibration` · `/finalize` · `/return-to-manager` · `/reopen` · `/cancel` · `/acknowledge` · `/calibrate` · `/appraisals/goals` (POST, PATCH) · `/hr/appraisal-cycles` (+ `/open` `/close` `/categories` `/appraisals` `/calibration` `/roster-import`) · `/hr/appraisal-rating-values` (GET, POST) · `/hr/appraisal-performance-levels` (GET, PUT)

---

## Add employee — focused check (requested)

**Frontend path:** `hr-employees.html` → `js/api/hr-employees.js:179-216` (`add-employee-form` submit) → builds payload → `apiClient.createHrEmployee(payload)` → `POST /api/hr/employees`.

**Payload the frontend sends** (`hr-employees.js:184-202`):
```json
{ "employeeCode", "name", "email", "phone", "forcePasswordReset",
  "dateOfJoining", "dateOfExit", "employeeType", "designation", "department",
  "managerId", "basicSalary", "role", "status", "password" }
```
`password` included only when typed. This matches `API-REQUIREMENTS.md` lines 128-140 **exactly** — no shape mismatch to fix.

**Live result:**

| Call | Result |
|---|---|
| `POST /hr/employees` (full payload above) | `404 Not found` — endpoint absent |
| `GET /hr/employees` (list the page loads on open, `hr-employees.js:9`) | `404 Not found` |
| `POST /hr/employees` per-row (bulk CSV upload) | `404` (same endpoint) |
| `POST /hr/employees/reassign-manager` | `404` |

**Verdict:** "Add employee" is fully built on the frontend and correct against the
contract; the backend has none of it. `hr-employees.html` can't even render its table —
`loadEmployees()`'s `.catch` fires and shows *"Could not load employees."* Nothing to
change in the frontend; the backend needs the `/hr/employees` CRUD + `/reassign-manager`
routes.

---

## Cross-cutting findings

1. **Role vocabulary mismatch.** Backend issues `role: "ORG_ADMIN"`. Frontend only knows
   `EMPLOYEE` / `HR` (`auth-guard.js:32` `data-requires-role`, every `hr-*.js`).
   Contract (`API-REQUIREMENTS.md:30`) says `role ∈ {EMPLOYEE, HR}`. RBAC sidebar
   hiding is currently commented out (`components/sidebar.html:21-26`), so this is
   **dormant, not active** — but re-enabling RBAC will hide all HR/manager nav from an
   `ORG_ADMIN`. Decide: does the frontend add `ORG_ADMIN`, or does the backend map it to
   `HR` on session responses?

2. **`forcePasswordReset` missing** from `/auth/me` and `/employees/me`. `auth-guard.js:14`
   and `login.js:16` branch on `session.forcePasswordReset`; `undefined` is falsy, so the
   forced-password-reset redirect **silently never fires**. Contract requires the field
   (`API-REQUIREMENTS.md:33`).

3. **Error envelope** is `{summary, details, stackTrace}`. Frontend reads only
   `body.summary` (`api-client.js:22`) → compatible. `stackTrace` was `null` on every
   response observed (the "stack traces to browsers" open decision in
   `ai-harness/README.md` is **not** currently violated). `details` is unused by the
   frontend.

4. **CORS is correct.** Preflight → `Access-Control-Allow-Origin: http://localhost:8080`,
   `Access-Control-Allow-Credentials: true`, methods `GET,POST,PATCH,PUT,DELETE,OPTIONS`.
   Cross-origin cookie auth (8080 → 8082) works.

5. **Security headers present** on all responses: `X-Content-Type-Options: nosniff`,
   `X-Frame-Options: DENY`, `X-XSS-Protection: 0`, `Cache-Control: no-store`.

6. **Undocumented endpoints.** `GET`/`PATCH /organization` are implemented and used by
   `settings.html`, but missing from `API-REQUIREMENTS.md`. Add them (response shape:
   `{id, name, username, hrNotifyEmail, status}`).

7. **`POST /auth/logout` isn't auth-gated** — returns `200` with no session. Minor.

8. **JWT cookie** `session_token`: HS256, 1-hour expiry, `HttpOnly`, `Path=/`. No `Secure`
   and no `SameSite` — acceptable on localhost; set `Secure` + an explicit `SameSite`
   before any HTTPS / real cross-site deployment.

## Not checked (need more than one ORG_ADMIN credential, or would mutate state)

- Successful `PATCH /employees/me` with real `{phone, address}`
- `POST /auth/change-password` to completion
- Login as an `EMPLOYEE` / manager account (role gating, `isManager`, `/manager/*`)
- Any write that creates or changes a row
