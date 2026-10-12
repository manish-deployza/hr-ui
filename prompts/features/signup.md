# Feature: Create organization (signup)

## Purpose
Self-service creation of a new tenant. Collects an organization username, a
work email, and a password, then signs the creator in.

## Who
Unauthenticated. Linked from `login.html`.

## Page
`signup.html` — auth-page chrome (no header/sidebar). Logic in
`js/api/signup.js`.

## Flow
1. Client validation:
   - org username matches `^[a-z0-9_-]{1,64}$` (mirrors `OrganizationService.USERNAME`), lower-cased as typed, live warning + `setCustomValidity`.
   - password checked against `passwordChecks()` (`js/password-checks.js`); failing rules listed live.
   - confirm-password must equal password.
   - terms checkbox required.
2. `POST /auth/signup { orgUsername, email, password }` via `apiClient.signup()` — same shared wrapper and mock route (`js/mock-data.js`) as every other call.
3. On success the backend sets the session cookie; redirect to `dashboard.html`.
4. On failure show `body.summary` (or a generic message) in the note alert.

## States
- Submit button disabled until the response resolves (no double-submit).
- Loading overlay via `apiFetch` (markup present on the page).

## Reference
`Prompts/multi-tenancy.md`, `Prompts/auth-and-security.md` (repo-root design notes).
