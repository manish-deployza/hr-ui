# Feature: Organization settings

## Purpose
One screen for an org administrator to view the organization's provisioned
identity, edit the two mutable fields, and change their own password.

## Who
`ORG_ADMIN` only. `js/api/settings.js` redirects any other role to
`dashboard.html` on `session-ready`.

## Page
`settings.html` — standard chrome (header + sidebar). Sidebar link added in
`components/sidebar.html`.

## Fields
| Field | Source | Editable |
|-------|--------|----------|
| Organization ID | `GET /organization` → `id` | no (provisioning) |
| Username | `GET /organization` → `username` | no (provisioning) |
| Status | `GET /organization` → `status` | no (provisioning) |
| Name | `GET /organization` → `name` | yes — `PATCH /organization { name }` (blank clears) |
| HR notification email | `GET /organization` → `hrNotifyEmail` | yes — `PATCH /organization { hrNotifyEmail }`, only sent when non-blank (server 400s on blank) |

## Password change
`POST /auth/change-password { currentPassword, newPassword }`. Client checks the
two new-password fields match before sending; backend re-validates strength.
Stays on the page and shows a success alert (unlike `change-password.html`,
which redirects).

## HR administrators
No dedicated endpoint — the card is a shortcut to `hr-employees.html`, where an
HR admin is just an employee created with `role = HR`.

## States
- Load: fields populate from `GET /organization`.
- Submit: submit button disabled until the response resolves.
- Error: inline `alert` per form; failed calls also raise a notification.

## Reference
`Prompts/multi-tenancy.md` (repo-root design notes) — OrgData table, employee
onboarding.
