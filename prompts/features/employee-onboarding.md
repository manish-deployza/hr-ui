# Feature: Employee onboarding (invite → set password → onboarding form → sign in)

Status: **Proposed (2026-09-30) — awaiting approval, no code written.** Source of truth for the
API is the backend spec `leave-backend/backend/prompts/features/employee-onboarding.md`.

## Purpose
An org admin invites a person (name, email, role). The person sets a password from the emailed
link, fills one three-step onboarding form (personal + address, emergency contact, pay & IDs),
previews it, submits, and signs in fresh. HR/admin then see and edit those details. This
replaces the old model where HR typed the whole record at creation and the employee only set
a password + directory profile.

## Who
| Actor | Screens |
|---|---|
| `ORG_ADMIN` | Invite user, resend invite, bulk import, everything HR can |
| `HR` | Employees list (view/filter/edit/exit — never create), edit a person's details |
| Invited user | `set-password.html` → `onboarding.html` → `login.html` |

## Status gate (replaces `directoryProfileComplete`)
`status` on `/auth/me` and employee rows: `INVITED, PENDING, ONBOARDED, ACTIVE, ON_NOTICE, EXITED`.
- `auth-guard.js`: `status === "PENDING"` and not on `onboarding.html` → redirect to `onboarding.html`.
  Any other status on `onboarding.html` → `dashboard.html`. (`/auth/me` is the only call a PENDING
  session can make; everything else is 403, so the guard must not call other endpoints first.)
- `INVITED` cannot log in; backend answers the generic `Invalid credentials`, which `login.js`
  already shows. No change (a distinct message would leak account state).

## Screens

### 1. `set-password.html` (changed)
After `setPassword` succeeds, redirect to `onboarding.html` (cookie already set; the
`apiClient.me()` hop stays). Expired/reused link → the existing 400 message, reworded to
"Ask your admin to resend the invite."

### 2. `onboarding.html` + `js/api/onboarding.js` (new; replaces `complete-profile.html`)
Standalone card page (no sidebar), same shell as the old complete-profile page.
- On load: `GET /onboarding` → fill all fields, mark steps done, jump to `nextStep`
  (`personal | emergency | payIds | review`).
- Steps: **Personal & address** → **Emergency contact** → **Pay & IDs** → **Review**.
  Each step's Save calls its `PUT` (`/onboarding/personal`, `/emergency`, `/pay-ids`), re-renders
  from the returned `OnboardingData`, and advances.
- **Review** renders the same `GET` data (unmasked) with an **Edit** button per section that
  returns to that step; **Submit** → `POST /onboarding/submit` → `apiClient.logout()` (best
  effort; session already revoked) → `login.html`.
- Client validation mirrors backend `FieldRules` (see Input rules); server `400` summary names
  the field — map it to that input's invalid-feedback, else show it in the step alert.
- Send only the documented properties per step (unknown properties are a `400`).
- Profile photo upload is dropped from this flow (`/employees/me/photo` is not reachable by an
  onboarding-only session; it stays on `profile.html`).
- Reuses fragments `components/dir-personal.html`, `dir-address.html`, `dir-pay.html`; emergency
  fields split out of `dir-address` if they are bundled there (check at implementation).

### 3. Invite user (changed: `hr-employees.html`, `js/api/hr-employees.js`)
The "Add employee" button/modal becomes **Invite user** (`data-requires-role="ORG_ADMIN"`, hidden
for HR): name, email, role (EMPLOYEE/HR) → `POST /admin/users` → success toast, reload list.
`409` → "That email already exists in this organization." (or seat-limit message from summary).
The old employee-code/DOJ/salary/etc. create fields are removed from the create path.

### 4. Employees list (changed)
- New **Status** column with a badge per status (`js/status-badge.js` gets the six statuses).
- New status filter select: All / Invited / Pending / Onboarded / Active / On notice / Exited,
  applied client-side in `applyEmployeeFilters` (`js/list-filter.js` gets a `status` predicate + test).
- Row action **Resend invite** (ORG_ADMIN, only `INVITED` rows) → `POST /admin/users/{id}/resend-invite`.
  A non-INVITED `400` is shown as returned.
- Manager pickers (`populateManagerOptions/Filter/Reassign`) list only `ONBOARDED`/`ACTIVE`/
  `ON_NOTICE`-eligible people — per backend spec: **Onboarded and Active only**.

### 5. Employee edit (changed)
Two separate saves from the detail/edit UI (no password field anywhere):
- **Employment & status** → `PATCH /hr/employees/{id}` (role, status, manager, designation,
  department, salary, dates…). For `INVITED/PENDING/ONBOARDED` users the status select offers only
  the current value and `EXITED`.
- **Personal details** (new modal section) → `PATCH /hr/employees/{id}/details` with
  `{phone, personalInfo{}, address{}, emergencyContact{}, payIds{}}`; sends only sections whose
  fields changed. Details are prefilled from `GET /directory` (HR now receives them; sensitive
  numbers come masked to the last 4 — a masked value is never re-sent unless the user retyped it,
  which is detected by the field being edited). HR gets `403` on non-EMPLOYEE rows: hide the
  section for them.

### 6. Bulk import (changed)
Response is `{created, skipped[]}` only. Remove any credentials/temp-password handling (none is
rendered today; verify and delete dead code). Header hint: required columns `name, email, role`;
`managerEmail` optional. **Org admin only:** hide the button for HR.

### 7. Directory (changed: `directory.html`, `js/api/directory.js`)
Read-only. Remove the Add-employee button, the 5-step `dir-modal` wizard, edit and deactivate
actions, and `createDirectoryEmployee / updateDirectoryEmployee / deactivateDirectoryEmployee`.
Detail modal shows personal/address/emergency/pay/salary for HR and ORG_ADMIN (masked numbers).

## Removed from the frontend
`complete-profile.html`, `js/api/complete-profile.js`, `apiClient.completeDirectoryProfile`,
`apiClient.createHrEmployee`, the three directory write methods, every `directoryProfileComplete`
read (`auth-guard.js`, `login.js`, `set-password.js`, mock data), `directory-profile-rules.js`
(replaced by `onboarding-rules.js`).

## Input rules mirrored in `js/onboarding-rules.js` (+ `.test.js`)
Free text: no control chars, no `<` `>`; name/emergencyName 128, gender 50, maritalStatus 40,
emergencyRelationship 50, address1/2/landmark 150, city/state 100. Email: shape, ≤190. Phone:
digits + `+ ( ) - space`, 7–15 digits, ≤20. Country/nationality: 2-letter code. Blood group: one of
A+ A- B+ B- AB+ AB- O+ O-. Postal: 3–20 letters/digits/space/hyphen. IFSC `^[A-Z]{4}0[A-Z0-9]{6}$`.
Bank account 5–34 alphanumeric. ID (Aadhaar/PAN/passport) 4–30 letters/digits/space/`/`/`-`.
DOB 1900-01-01 … yesterday. Mandatory sets per step as in the backend spec table.

## API client (`js/api-client.js`)
Add: `inviteUser`, `resendInvite`, `getOnboarding`, `saveOnboardingPersonal`,
`saveOnboardingEmergency`, `saveOnboardingPayIds`, `submitOnboarding`, `updateHrEmployeeDetails`.
Remove the methods listed above.

## Mock mode (`js/mock-data.js`)
Route the new endpoints in the in-memory db; `/auth/me` returns `status`; login rejects
`INVITED`; set-password moves INVITED→PENDING; submit moves PENDING→ONBOARDED; import returns
`{created, skipped}`. Mock employees get a `status` spread across all six values.

## Files
New: `onboarding.html`, `js/api/onboarding.js`, `js/onboarding-rules.js`, `js/onboarding-rules.test.js`.
Changed: `js/api-client.js`, `js/auth-guard.js`, `js/api/set-password.js`, `js/api/login.js` (comment
only), `hr-employees.html`, `js/api/hr-employees.js`, `js/status-badge.js`, `js/list-filter.js`
(+test), `directory.html`, `js/api/directory.js`, `js/mock-data.js`, `API-REQUIREMENTS.md`.
Deleted: `complete-profile.html`, `js/api/complete-profile.js`, `js/directory-profile-rules.js`
(+test), `components/dir-identity.html`, `dir-employment.html` if unused after the wizard goes.

## Edge cases
- PENDING user opens any other page → guard redirects to `onboarding.html`.
- PENDING user closes the tab, logs in again → login → guard → onboarding at `nextStep`.
- Non-PENDING user opens `onboarding.html` → dashboard.
- Submit with a step incomplete → `400` lists steps; jump to the first named step.
- Known backend gap: a `PUT /personal` with null `dateOfBirth` keeps the saved value; the form
  requires DOB client-side anyway.
- No new config or feature flags; nothing stored in localStorage.

## Open questions (defaults in bold; say if you want otherwise)
1. Invite UI as a **modal on `hr-employees.html`** rather than a separate `admin-invite.html` page.
2. Keep the details edit as a **section inside the existing employee edit modal** rather than its own page.
3. **Drop the photo step** from onboarding (endpoint unreachable while PENDING).
4. Login for `INVITED` keeps the **generic "Invalid credentials"** (no "check your invite email" hint).
