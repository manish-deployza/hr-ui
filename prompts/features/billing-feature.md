# Feature: Billing / Subscription — Coding Patterns Reference

## Purpose
Reference doc capturing how the interview-credit billing/subscription module
was built in the `product-assess-server` codebase (`Romil Ziniapps/`), so the
same patterns/conventions can be reused when billing is implemented for
`leave-frontend`. Not a spec for an existing page in this repo — there is no
billing feature here yet.

## Overview
Credits are sold in blocks and gate a paid action (there: creating an
assessment). No stored balance — usage and allowance are both computed live
on each check. A purchase goes through a strict state machine
(`CREATED -> PAID | FAILED`) settled by whichever of three independent paths
(client callback, webhook, reconciliation poll) confirms it first, guarded so
exactly one of them can act.

## Layering (Controller -> Flow -> Service -> Repo)
| Class | Role |
|---|---|
| `SubscriptionController` | Thin. Binds `*Form`/`@RequestBody`, delegates to Flow. No logic. |
| `SubscriptionFlow` (extends `AbstractFlow`) | Reads org from `UserContext` (never request input), `checkOrgId` before acting on a loaded order, maps `*Pojo` -> `*Data`. |
| `SubscriptionService` (`@Transactional`) | Owns every business rule: allowance math, the gate, tax computation, the settlement transition. |
| `InterviewOrderRepo` | JPQL/`EntityManager`, always org-scoped, exposes the one guarded `UPDATE` method. |
| `SubscriptionConfig` | `@Value`-bound `subscription.*`/`pricing.*`/`razorpay.*` properties, getters only. |

Rule of thumb: **if it's a business rule, it lives in the Service**, so it
holds for every caller (controller, scheduler, webhook), not just the HTTP
path.

## Coding patterns
- **Live-computed, not stored.** `used` = `COUNT` query, `purchased` = `SUM`
  over paid orders. No decrement/increment anywhere — eliminates balance
  drift.
- **Gate as a single reusable method.** `assertScope(orgId, requested)`
  throws `409`; every credit-consuming caller runs through it once.
- **Idempotent terminal transition.** Settlement uses a conditional
  `UPDATE ... WHERE status = 'CREATED'`, not read-then-write — concurrent
  settlement paths can't be serialized by an in-memory check. Only the caller
  that sees `rows changed > 0` fires the receipt email.
- **Snapshot-at-write for anything legal/financial.** Buyer + seller billing
  details are copied onto the order at purchase time, because both sources
  are mutable and a historical invoice must not drift when a profile is
  edited later.
- **Rate frozen per-row.** The unit price is stored on the order, not looked
  up from config at read time — a later price change never rewrites a past
  order.
- **Tax/line-item detail as extensible JSON, not columns.** Adding a new
  component needs no migration.
- **External gateway behind one gated service.** A single service class
  knows the payment gateway; an `*.enabled` flag switches between a
  synthetic stub and the real calls, so dev/tests run without credentials.
- **Reconciliation as a catch-all, not the primary path.** A background poll
  only touches orders past a minimum age, so it never races a fresh one.
- **Audit log is diagnostics-only.** Written in its own transaction; its own
  write failure is swallowed — it must never break the payment it's logging.

## Variable / data types
| Concept | Type | Why |
|---|---|---|
| Money (rate, totals) | `long`, minor units (paise/cents) | No float rounding error |
| Timestamps | `Instant`, UTC | Timezone-safe, set on create/update |
| Status/enums | Java `enum`, stored as `STRING` | Never ordinal — safe to reorder/add values |
| Line-item / snapshot detail | `String` (JSON) + a typed data class via one shared object mapper | Extensible without schema migration |
| Order id | Sequence seeded high, gapless (`allocationSize=1`) | It's the customer-facing order number |
| Config values | primitive fields bound from properties, getters only | Secrets get no default; everything else does |

## How to reuse this for leave-frontend's billing
Walk the same four questions, then write the equivalent doc for this repo's
implementation once it exists:
1. What's computed live vs. stored (usage/allowance)?
2. What state machine exists and who's allowed to flip it (order status)?
3. What gets snapshotted at write-time and why (invoice/billing detail)?
4. What money/time/status types are used, and are they consistent with the
   table above?

## Reference
`Romil Ziniapps/product-assess-server/prompts/features/subscription.md` —
full original feature doc this was distilled from.
