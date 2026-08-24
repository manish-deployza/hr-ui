

# Frontend Discussion Log

Records the decisions made to adapt [`Reasoning/08-frontend-design.md`](../Reasoning/08-frontend-design.md) (originally written for a React SPA) onto the static-site tech stack documented in [`Romil Ziniapps/docs/frontend-tech-stack.md`](../Romil%20Ziniapps/docs/frontend-tech-stack.md) — **the technical patterns from that doc only, none of its product names, branding, or copy.** This repo is an unrelated product (a Leave Management System); nothing here should reference Deployza/ZiniApps/Assess.

Append new entries here as further decisions come up — don't edit history, add below.

## 1. No React — static multi-page site instead of an SPA

**Decision**: Drop the React SPA entirely. Build a static HTML/CSS/vanilla-JS site, one `.html` file per screen, packaged as a Maven WAR and served by Jetty in dev — the same shape as `product-assess-ui`/`product-assess-exam` in the reference stack.

**Why**: explicit instruction — this project does not use React.

**How it applies**: every React-specific concept in `08-frontend-design.md` (routes, components, hooks, context) gets re-expressed below as its static-site equivalent. The *functional* requirements in `08` (which screens exist, who can see them, what they show) are unchanged — only the implementation mechanism changes.

## 2. Language: JavaScript, not TypeScript

**Decision**: plain JavaScript (ES, no build/transpile step), matching the reference stack's convention (`var`/`function`, no bundler).

**Why**: confirmed directly; keeps the stack dependency-free like the reference repos (no npm build step at all).

## 3. Styling: plain Bootstrap 5 CSS + manual classNames

**Decision**: import Bootstrap 5's CSS directly (CDN or vendored), write `class="..."` attributes by hand on plain HTML elements. No `react-bootstrap` (moot without React), no Tailwind.

**Why**: confirmed directly. Simplest option, zero extra dependency, and it's exactly what the reference stack's own repos do.

## 4. Visual design: reuse the Ziniapps visual language, not its branding

**Decision**: reuse the design tokens documented in `frontend-tech-stack.md` as the starting visual system —

- Primary/accent `#1a73e8`, danger `#d93025`, success `#1e8e3e`, warning `#f9ab00`
- Text: primary `#202124`, body `#3c4043`, secondary `#5f6368`; border `#dadce0`; page background `#f8f9fa`
- **Roboto** font (Google Fonts CDN), 600-weight headings
- White cards, `1px solid #dadce0` border, `8px` radius, shadow `0 1px 2px rgba(60,64,67,.3)`
- Buttons `4px` radius
- Bootstrap 5 for responsive layout

**Why**: confirmed directly — reuse the pattern, carry zero ZiniApps/Deployza naming, copy, or logos.

**How it applies**: `StatusBadge`-equivalent colors (see §7) should be chosen from this same palette (e.g. success green for `APPROVED`, danger red for `REJECTED`, warning amber for `PENDING_*`) rather than inventing a new palette.

## 5. Auth: JWT delivered via an HttpOnly cookie, not Bearer header

**Decision**: `POST /api/auth/login` sets the JWT as an `HttpOnly` (and `SameSite=Lax` or `Strict`) cookie via `Set-Cookie`, instead of (or in addition to — TBD with backend) returning it in the JSON response body. Every page's `fetch()` calls use `credentials: 'include'`; the browser attaches the cookie automatically. No JS ever reads or stores the token.

**Why**: `08-frontend-design.md` originally kept the JWT in a React context in memory specifically to avoid `localStorage`'s XSS-persistence risk, trading that for "lose session on hard reload." Without React there is no cross-navigation JS memory at all — every screen is a fresh page load — so that scheme cannot work here regardless of storage choice. An HttpOnly cookie is strictly better on both axes it cared about: JS can never read it (stronger than in-memory, which *is* readable by injected script during the page's life), and it survives navigation/reload naturally (no forced re-login), while still carrying the exact same JWT/claims (`sub`, `role`, `isManager`, `organizationId`) `06-auth-and-security.md` already specifies. Confirmed directly, including the follow-up question about JWT vs. an opaque session id — it's the same JWT, just cookie-transported.

**How it applies / follow-up needed**:
- `06-auth-and-security.md` §"Authentication" and its OWASP §2 CORS line ("CORS locked to the known React origin only") need a small update once this is implemented — cookie-based, same-origin (per §9 below), so CORS becomes largely moot for the frontend↔API path.
- **Flagged, not yet resolved**: cookie-based auth needs a CSRF stance. Because every page and the API share one origin (§9), and all writes go through JSON `fetch()` (not a plain HTML `<form>` post, which can't set `Content-Type: application/json` cross-site without triggering a blocked CORS preflight), the practical CSRF surface is small — but this should be an explicit line in `06-auth-and-security.md` (e.g. `SameSite=Strict` as the primary defense, confirm whether a CSRF token is still wanted defense-in-depth) rather than left implicit. Revisit before backend implementation.
- `RoleGuard`'s replacement (§6) still applies — hiding nav/pages client-side is UX only; every write is re-authorized server-side per `06`'s existing rule, unchanged by this decision.

## 6. `RoleGuard` → per-page auth-guard script

**Decision**: a shared `js/auth-guard.js`, included on every authenticated page, calls a "who am I" endpoint (e.g. `GET /api/auth/me`) on load, hides the page content until that resolves, and:
- redirects to `login.html` on an unauthenticated response,
- redirects to `change-password.html` if `force_password_reset` is set,
- shows/hides nav items and page sections based on `role`/`isManager` claims.

**Why**: this is the direct static-site translation of `08`'s `RoleGuard` component — same purpose (UX convenience, not the security boundary), different mechanism (a page-load script instead of a route wrapper).

## 7. Shared components → shared partials + render helpers

React components become either an injected HTML partial (header/footer/sidebar, à la the reference stack's `loader.js`) or a small JS function that renders a DOM fragment into a container, called from whichever page needs it:

| `08-frontend-design.md` component | Static-site equivalent |
|---|---|
| `LeaveRequestForm` | `js/leave-request-form.js` — renders the form, shows/hides `situationType` and the notice-period warning based on the selected leave type, same client-side check mirrored from the server so the user sees a problem before submitting |
| `LeaveBalanceCard` | `js/leave-balance-card.js` — renders one card per leave type from `GET /api/leave-balances/me`, no client-side computation |
| `ApprovalTimeline` | `js/approval-timeline.js` — renders whatever ordered approval steps the API returns as a step tracker; same function serves 1-step and 2-step chains |
| `NotificationBell` | `js/notification-bell.js` — polls `GET /api/notifications/me?unread=true` every 60s and on page load (no true "route change" without a router) |
| `RoleGuard` | `js/auth-guard.js`, see §6 |
| `StatusBadge` | `js/status-badge.js` — one function mapping a `leave_request.status` value to a consistent color/label pair, pulling colors from §4's palette; pairs color with text/icon (not color alone) per `08`'s accessibility note |

## 8. Server-state and forms: direct `apiClient` calls, no library

**Decision**: no React Query/SWR/React Hook Form (all moot without React). Reuse the reference stack's pattern instead: a shared `js/api/api-client.js` (real) and `js/api/api-client-mock.js` (mock) with identical method signatures, switched by `js/api/api-router.js` based on a `config/ui-config.json` `api.mode: "mock"|"real"` flag. Every page script calls only `apiClient.*`, never `fetch()` directly. Forms are plain vanilla JS — read values on submit, show/hide conditional fields (e.g. `situationType`) with plain DOM show/hide, validate client-side as a UX mirror of the server check (never the source of truth).

**Why**: direct consequence of §1 — no React means no React-ecosystem data/form libraries. The reference stack already solved "realistic mock data before the backend endpoint exists" (the same problem `08`'s `VITE_USE_MOCKS` flag solved) with this exact pattern, so it's reused rather than reinvented.

## 9. Packaging & serving: Maven WAR + Jetty, single origin with the API

**Decision**: package as a Maven WAR, served by Jetty in dev (`mvn jetty:run`) — matching every repo in the reference stack. Frontend and backend are assumed same-origin per company subdomain (`acme.yourapp.com` serves both the static pages and `/api/**`), matching `08-frontend-design.md`'s existing multi-tenancy design ("the API client's base URL is just the current origin") — this is what makes §5's cookie approach clean (no CORS needed for the frontend↔API path).

**Why**: "use this tech stack" — this is the deployment shape every sibling repo in the reference doc uses, and it fits `08`'s already-decided multi-tenancy model without changes.

**Superseded by §11 below** — reconsidered once scaffolding started; this repo carries no Java code at all, so a Maven/WAR/Jetty wrapper around it added a build tool with nothing for it to build.

## 11. Correction: no Maven — plain static site

**Decision**: drop `pom.xml`/`web.xml`/Jetty entirely. The frontend is just HTML/CSS/JS files on disk — served in dev by any static file server (e.g. `npx serve .` or `python -m http.server`), or via whatever the real deployment target turns out to be (a CDN, a static-hosting bucket, or a thin reverse-proxy in front of the API — not yet decided).

**Why**: questioned directly while scaffolding — §9's reasoning ("matches every sibling repo") doesn't hold up once you notice *why* those repos use Maven: they're static-content modules built and versioned alongside Java siblings in the same multi-module reference project, so Maven is the whole org's shared build tool, not something that content itself needs. This repo has no such sibling Java project pulling it into a shared build, so adding Maven here would be a build tool with nothing for it to build — pure ceremony.

**How it applies**: pages live directly at the project root (no `src/main/webapp/` wrapper, no `WEB-INF/`). `api-client.js`'s base URL still needs to be the current origin per `08-frontend-design.md`'s multi-tenancy design — same-origin cookie auth (§5) depends on the frontend and `/api/**` being served from the same host, so whatever the real static host ends up being, it must sit behind the same origin as the backend (e.g. a reverse proxy mapping `/api/**` to the backend and everything else to these static files) — flagged as an open item below since the actual production hosting mechanism isn't decided yet.

## 12. Unaffected by the pivot — carried over from `08-frontend-design.md` unchanged

- **Multi-tenancy**: per-company subdomain, tenant implicit in origin, no org-picker screen, no `organizationId` field in the UI. `/login` may show the resolving org's name cosmetically.
- **Accessibility & responsiveness baseline**: semantic HTML, keyboard-navigable forms/approval actions, visible focus states, color-paired-with-text status indicators, responsive down to tablet width.
- **What's deliberately not built for v1**: no offline/PWA, no dark mode (revisit if requested — CSS variables, not an architecture concern), no native mobile app.

## 13. Shell visual design: Bootstrap's official Dashboard example

**Decision**: the app shell (top navbar + sidebar + main content) follows Bootstrap's official Dashboard example (`getbootstrap.com/docs/5.0/examples/dashboard/`) structure and CSS exactly — dark `navbar-dark bg-dark` top bar, light bordered sidebar (`bg-body-tertiary`, sticky, offcanvas below `md` width), Bootstrap's grid (`container-fluid`/`row`/`col-md-3 col-lg-2` sidebar/`col-md-9 ms-sm-auto col-lg-10` main). Implemented in `components/header.html`, `components/sidebar.html`, and the shell CSS in `css/styles.css`; every page's body now follows this same grid pattern (see `dashboard.html` for the canonical shape). Bootstrap's JS bundle (`bootstrap.bundle.min.js`) is now loaded on every authenticated page — needed for the offcanvas/navbar-toggler behavior, previously we only loaded the CSS.

**Why**: confirmed directly, with a concrete reference link, after two other directions were floated and not settled (a "Google Cloud Console" look per §4's original tokens, then "Material Design 3" which stalled on an implementation-approach question — hand-rolled MD3 CSS vs. Google's Material Web Components vs. re-skinning Bootstrap). The Bootstrap Dashboard example resolves that cleanly: it's the officially-supported, already-responsive pattern for exactly this shape of app (sidebar nav + data tables), needs no new dependency (we already load Bootstrap 5 CSS per §3), and its mobile-collapse behavior (offcanvas) satisfies `08-frontend-design.md`'s "responsive down to tablet width" requirement better than the hand-rolled flexbox shell it replaces.

**How it applies**: §4's color tokens (`--color-primary` etc.) and the card/status-badge styling are unaffected — only the shell (navbar/sidebar/grid) changed. The `.app-shell`/`.app-sidebar`/`.app-main` classes from the original build no longer exist; new pages must use the grid pattern in `dashboard.html`, not the old flex wrapper.

## 14. Static asset/page paths: page-relative, not root-relative

**Decision**: every internal `href`/`src`/`fetch()` reference to a page, `components/*.html` partial, `css/`, or `js/` file is page-relative (`css/styles.css`, `components/header.html`, `dashboard.html`), not root-relative (`/css/styles.css`). `/api/**` calls in `js/api/api-client.js` are unaffected — those still target the backend's API root and stay root-relative, per §11.

**Why**: hit directly while testing with VS Code's Live Server. Live Server serves whatever folder is open as the VS Code workspace, and root-relative paths resolve against *that* root — with `leave-frontend` (the parent, containing `Reasoning/` and `Romil Ziniapps/` too) open instead of `fronted/` itself, every `/css/...`/`/js/...`/`/components/...` reference 404'd, and every nav link pointed at a page that doesn't exist at the server root. Rather than requiring `fronted/` specifically be opened as the workspace/server root, page-relative paths resolve correctly regardless of what folder a static server is pointed at, since they're resolved against the current page's own URL rather than the domain root — the app now works under any serving setup without a required VS Code/server configuration step.

**How it applies**: `js/loader.js`'s active-nav-link highlighting was changed from comparing raw `href` attribute strings to comparing `link.pathname` (the browser-resolved absolute path) against `window.location.pathname` — this is what makes the comparison still work correctly even though the `href` attributes themselves are now relative.

## 15. Responsive tiers: custom breakpoints layered on Bootstrap's grid

**Decision**: five custom tiers — Mobile small (320–479px), Mobile large (480–639px), Tablet (640–1023px), Laptop/Desktop (1024–1439px), Large Desktop (1440–1919px) — implemented as plain `@media` rules in `css/styles.css`, layered on top of (not replacing) Bootstrap's own grid breakpoints (576/768/992/1200/1400) that already drive `col-md-*`, `offcanvas-md`, `d-md-none` throughout the shell and every page. The custom tiers tune type scale, spacing, and table/header density; Bootstrap's own breakpoints still decide when the sidebar collapses into the offcanvas.

**Why**: confirmed directly, after flagging that we can't recompile Bootstrap's CDN CSS with custom breakpoint values (no build step). Layering was chosen over replacing Bootstrap's grid — a full replacement would mean rewriting every `col-md-*`/`offcanvas-md`/`d-md-none` across the shell and all 9 pages built so far for a breakpoint scale (768 vs. 640/1024) that's close enough not to matter visually for this app, while still honoring the requested tiers for the things that do need to be more precisely tuned (font size, density).

**How it applies**: also fixed two real bugs found while implementing this — (1) `.sidebar`'s `position: sticky; height: calc(100vh - 48px)` had been applied unconditionally at all screen sizes instead of only to the inner `.offcanvas-md` element at `md`+ (matching the real Bootstrap example's CSS, confirmed via its actual `dashboard.css`), which would have rendered as an empty full-height box on mobile; (2) the login/change-password auth card used a fixed `width: 360px`, which overflows horizontally on a 320px phone — changed to `w-100` + `max-width: 360px` with side padding on the wrapper. Also wrapped every `<table>` (`dashboard.html`, `leave-history.html`, `manager-team-requests.html`) in `.table-responsive`, and the header's username/sign-out label now hide below 480px (`#header-user-name`, `.btn-label`) so the navbar doesn't overflow on small phones.

## 16. Correction: Maven/WAR/Jetty reinstated for local serving

**Decision**: `pom.xml` added back at the project root (`com.deployza:leave-management-frontend`, packaging `war`). `maven-war-plugin`'s `warSourceDirectory` and `jetty-maven-plugin`'s `webAppSourceDirectory` both point at `${basedir}` directly — no `src/main/webapp/` wrapper, no file moves. `mvn package` produces `target/leave-management.war`; `mvn jetty:run` serves it on `:8080`.

**Why**: explicit instruction this session ("create a pom and war file ... and run the server") — reverses §11's *build-tool* call, but only for local packaging/serving. §11's actual insight (page-relative paths, so the app works under any static server without a required workspace-root configuration) is untouched and is exactly why pointing both plugins straight at the existing root worked with zero file moves.

**How it applies**: `jetty-maven-plugin`'s `webAppSourceDirectory` param logs as "read-only" in its own warning text but must still be set explicitly — omitting it makes the plugin serve an empty `target/webapp-synth/` instead (verified both ways). Also: Jetty on Windows memory-maps static files it serves, which holds an OS-level file lock until the server stops — editing a page while `mvn jetty:run` is live can fail with `EPERM`/rename errors; stop the server first, edit, then restart.

## 17. HR admin pages built out; sidebar role-gating temporarily disabled for dev preview

**Decision**: the six `hr-*.html` pages the sidebar already linked to (`hr-requests`, `hr-employees`, `hr-leave-types`, `hr-holidays`, `hr-lop-watchlist`, `hr-audit-log`) were built as read-only listings against the existing `hrX()` mock/real `apiClient` methods — they were dead links before. Separately, `components/sidebar.html`'s `data-requires-manager` / `data-requires-role="HR_ADMIN"` attributes (plus `hidden`) were removed from the "My Team" and "HR Admin" wrapper `<div>`s, so every nav section is visible regardless of session role. `js/auth-guard.js`'s `applyRoleVisibility()` mechanism itself is untouched — it just has no matching elements to act on right now. A `?role=HR_ADMIN` query-param override was also added to `api-client-mock.js`'s `me` fixture, independent of the gating toggle, so role-gated content can still be previewed once gating is restored.

**Why**: explicit requests ("create good admin pages", "show all the pages in the sidebar").

**How it applies**: re-add `data-requires-manager` / `data-requires-role="HR_ADMIN"` (+ `hidden`) to those two wrapper `div`s before this is anything more than a local dev preview — see the Open Items list below, this is a tracked reversal, not an oversight. `hr-employees.html` and `hr-holidays.html` are read-only for now — `flow.md`'s "CRUD" language for those pages is aspirational, not yet built (impose-LOP and holiday create/delete have client methods wired but no UI control calling them).

## 18. One-on-One and Appraisal frontend modules built

**Decision**: built the 6 routes each module's own "Frontend" section specifies (`16-module-one-on-one.md`, `17-module-appraisal.md`): `one-on-ones.html` + `one-on-one-view.html`, and `appraisals.html` + `appraisal-view.html` + `manager-appraisals.html` + `hr-appraisal-cycles.html`. Followed this repo's existing conventions rather than inventing new ones — `apiClient` methods added identically to both `api-client.js` and `api-client-mock.js` (§8), `js/status-badge.js` extended with `ONE_ON_ONE_STATUS_BADGE_MAP` / `APPRAISAL_STATUS_BADGE_MAP` / `APPRAISAL_GOAL_STATUS_BADGE_MAP` / `APPRAISAL_CYCLE_STATUS_BADGE_MAP` plus a generic `renderBadge(status, map)` (old `renderStatusBadge()` now just calls it with the leave map, unchanged for existing callers), same card/table shell as every other page.

**Why**: explicit request.

**How it applies**: `one-on-one-view.html`'s `manager_private_notes` panel is gated by comparing the viewer's session id directly to the session's `managerId` — not role or `isManager` — matching `16`'s explicit "ownership-based, not HR-visible by default" access rule verbatim. This is the one genuinely new authorization *pattern* introduced (every other page in this app gates on `role`/`isManager`, never on comparing two specific ids). Known mock limitation carried over from §8: `getOneOnOneSession()` / `getAppraisal()` ignore their `id` argument and always return the same fixture, same as the pre-existing `getLeaveRequest()` — fine for previewing one record, not for distinguishing rows in a list.

## 19. Table markup correction: nest `.card` around `.table-responsive`, don't apply `.card` to `<table>` directly

**Decision**: every `<table class="table ... card">` across the app was changed to `<div class="card"><div class="table-responsive"><table class="table table-hover align-middle">`. `css/styles.css`'s `.card` rule gained `overflow: hidden`.

**Why**: a `.card`'s rounded corners and box-shadow don't clip a table's own square-cornered borders when the class is applied directly to the `<table>` element — reported as tables looking misaligned/not-proper. Nesting is the correct Bootstrap composition (the pattern `leave-request-form.js`'s `.row` already used inside its `.card` wrapper, rather than combining `row` and `card` on one element) — the same anti-pattern briefly recurred in `hr-appraisal-cycles.html`'s "New cycle" form (a `<form class="row g-3 card p-3">`) and caused a real visible misalignment bug (its heading wasn't inside any `col-*`, so it didn't share the row's gutter indent) — fixed the same way, form now lives inside a plain `.card` wrapper instead of being one itself. `css/styles.css` also picked up a global light/uppercase `<thead>` treatment while addressing this, applied once rather than per page.

**How it applies**: any future table follows this nesting; never combine `.row` or `.card` classes with grid/flex utility classes that carry negative margins on the same element that also carries `.card`.

## 20. Real 2026 holiday calendar; split into National vs. Other compulsory

**Decision**: `hr-holidays.html`'s mock data replaced with the actual 2026 list provided — 3 non-negotiable national holidays (Republic Day, Independence Day, Gandhi Jayanti) and 5 other compulsory holidays chosen from a longer gazetted candidate list (Cheti Chand, Ram Navami, Good Friday, Buddha Purnima, Muharram) — rendered as two separate tables rather than one flat list with a type column or icons.

**Why**: explicit request, including an explicit "remove icons, group into national holidays" correction after an icon-column version was tried first.

## 21. Footer removed

**Decision**: `js/loader.js` no longer fetches `components/footer.html`; that file was deleted. The `#footer-placeholder` `<div>` was left in place on every page (renders empty, no visual footprint) rather than edited out of every `.html` file individually.

**Why**: explicit request; leaving the empty placeholder was the smaller diff for an identical visual result.

## 22. Login/profile field validation

**Decision**: `login.html`'s email input got `pattern="\w+@deployza\.com"` (native HTML5, no JS) restricting sign-in to the org domain. `profile.html` gained a read-only `employeeCode` field (surfacing `employee_code` from `02-database-schema.md`, HR-managed like name/email/role) and its phone field changed to a fixed `🇮🇳 +91` prefix + `pattern="\d{10}"`.

**Why**: explicit request. Native `pattern`/`title` attributes were used rather than a JS validation library or the `needs-validation`/`was-validated` Bootstrap pattern already used on `leave-apply.html` — these are single always-required fields with no conditional show/hide logic, so the plain HTML5 constraint (which blocks the `submit` event natively, before any JS runs) is the whole job.

## Open items for a future entry

- Exact query-param convention for detail views (e.g. `leave-view.html?id=123`) vs. a path-based scheme — proposed in `flow.md`, not yet separately confirmed.
- CSRF stance for `06-auth-and-security.md` (flagged in §5).
- Whether the login response body should still echo user/role info (for the page to render a name/greeting) even though the token itself moves to a cookie.
- Real production hosting mechanism for the static files, and how it stays same-origin with the API (flagged in §11) — not yet decided.
- Sidebar role-gating is currently disabled (§17) — restore `data-requires-manager`/`data-requires-role="HR_ADMIN"` before this leaves local dev preview.
- `hr-exit.html` (Exit Settlement review, `flow.md`'s HR flow) is still not built — `hrExit()`/`finalizeExit()` client methods exist and are wired, but there's no page or sidebar link yet.
- HR override (`overrideLeaveRequest()`) and impose-LOP (`imposeLop()`) client methods exist but no page calls either — `leave-view.html` has no HR-override control, `hr-employees.html` has no impose-LOP control.
- Mock fixtures (`getOneOnOneSession()`, `getLeaveRequest()`, `getAppraisal()`) ignore their `id` argument (§18/§8) — fine for previewing a single record, not for a real multi-record demo; would need id-aware fixtures before that matters.
