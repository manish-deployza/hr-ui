# Feature: Forgot password

## Purpose
Placeholder recovery screen. There is no self-service password reset yet —
passwords are HR-set, with a forced change on first login
(`change-password.html`).

## Who
Unauthenticated. Linked from `login.html`.

## Page
`forgot-password.html` — auth-page chrome. Logic in
`js/api/forgot-password.js`.

## Current behaviour
Submitting the form calls no endpoint; it shows a static note telling the user
to ask their HR admin to reset the password.

## When the real flow lands
Two-step, per `Prompts/auth-and-security.md`:
1. `POST /auth/forgot-password { email }` — always returns the same
   ambiguous confirmation (no account enumeration).
2. `POST /auth/reset-password { token, newPassword }` from the
   `?token=` link.

## Reference
`Prompts/auth-and-security.md` (repo-root design notes).
