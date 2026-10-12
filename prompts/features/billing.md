# Feature: Billing / Subscription

## Purpose
One screen for an org administrator to see the org's current subscription,
browse the plan catalog, change plans, and cancel (downgrade to FREE).

## Who
`ORG_ADMIN` only, matching the backend's `@PreAuthorize("hasRole('ORG_ADMIN')")`
on `BillingController`. `js/api/billing.js` redirects any other role to
`dashboard.html` on `session-ready` — same pattern as `js/api/settings.js`.

## Page
`billing.html` — standard chrome (header + sidebar), single page, card-based
layout matching `settings.html`. Sidebar link added under the existing
`data-requires-role="ORG_ADMIN"` group in `components/sidebar.html`, next to
Settings.

## API
| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | `/billing/plans` | — | Array of `{code, name, seatLimit, priceMinor, currency, billingPeriod, customPricing}` | **Confirmed against the real backend.** `seatLimit` is `Integer.MAX_VALUE` (2147483647) for unlimited. `customPricing: true` (Enterprise) means `priceMinor` is a placeholder, not a real free price — the UI shows "Custom pricing" instead. No `features` array is sent; the card's feature bullets are derived client-side from `seatLimit`/`customPricing`. |
| GET | `/billing/subscription` | — | `{planCode, planName, status, currentPeriodEnd}` (assumed — adjust once backend ships it) | **Not implemented on the backend as of this writing — returns `404 {"summary":"Not found"}`, confirmed against a live ORG_ADMIN session.** `billing.js` fetches this independently of `/billing/plans` (not `Promise.all`) so the plan catalog still renders while this one 404s. |
| POST | `/billing/subscribe` | `{planCode}` | `{}` — reloads subscription on success | **Also not implemented — returns the same `404 {"summary":"Not found"}`**, confirmed by clicking Subscribe against the live backend. |
| POST | `/billing/cancel` | — | `{}` — downgrades to FREE | Untested — the cancel button is only shown once a plan is active, which itself depends on `/billing/subscription` working. Assume the same gap until confirmed otherwise. |

The webhook endpoint (`/billing/webhook/razorpay`) is server-to-server only —
no frontend involvement.

## Sections
1. **Current subscription card** — plan name, status, renewal date (from
   `GET /billing/subscription`). "Cancel subscription" button, only enabled
   when the current plan isn't already FREE.
2. **Plan catalog** — one Bootstrap card per plan (`GET /billing/plans`) in a
   3-up grid: name, price, a checkmarked feature list, and a full-width
   button. The active plan's card is highlighted (`border-success` + a
   "Current plan" badge) with its button disabled; every other card gets a
   "Subscribe" button.

## Actions & Edge Cases
- **Subscribe/change plan** — confirm dialog before `POST /billing/subscribe
  {planCode}` (this is a real money/plan change, not a silent write). On
  success, reload the subscription card.
- **Cancel** — confirm dialog warning it downgrades to FREE immediately, then
  `POST /billing/cancel`. On success, reload the subscription card.
- Buttons disabled while their request is in flight (`withSubmitDisabled`
  pattern from `utils.js`), same as `settings.js`.
- Errors surfaced as inline `alert`, same as `settings.js` (`err.message` from
  the `{summary}` envelope).
- New org with no subscription yet: treat as implicit FREE plan — subscription
  card shows FREE / no renewal date rather than erroring.

## Relevant Files
| File | Change |
|---|---|
| `billing.html` | New page |
| `js/api/billing.js` | New — page logic, role gate, load + subscribe/cancel handlers |
| `js/api-client.js` | Add `billingPlans()`, `billingSubscription()`, `subscribe(planCode)`, `cancelSubscription()` |
| `components/sidebar.html` | Add "Billing" link under the `ORG_ADMIN` group |
| `js/mock-data.js` | Add mock routes for the 4 endpoints so the page works in mock mode |
| `API-REQUIREMENTS.md` | Add the Billing section once this doc is approved (doc stays in sync with what's actually built, per `settings.md`'s pattern) |

## Reference
Pasted `BillingController`/`BillingWebhookController` endpoint list (this
conversation) — origin of the API surface above.
`prompts/features/billing-feature.md` — unrelated coding-pattern reference
from another codebase, not a spec for this page.
