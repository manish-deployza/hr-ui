# Leave Management Frontend

Static HTML/CSS/JS frontend for the leave & appraisal management system. No build step, no framework, no npm — plain pages loading plain scripts.

## Running it

Requires Maven + JDK 17.

```
mvn jetty:run
```

Serves the site at http://localhost:8080/. There's no `src/main/webapp` — the project root itself is the webapp root (see `pom.xml`).

`mvn package` builds a WAR (`target/leave-management.war`) for dropping into Tomcat alongside the future Spring backend.

## Config & mock vs. real API

`js/config.js` is the first script on every page. It fetches `config.json` and
exposes `window.AppConfig` / `window.AppConfigReady`. Copy `config.json.example`
to `config.json` and edit it for your environment — `config.json` is per-machine
and not meant to be committed.

```json
{
  "appName": "Employee Hub",
  "apiBaseUrl": "http://localhost:8080/api",
  "mockMode": false,
  "features": {}
}
```

- `mockMode: true` — `apiFetch` (in `js/utils.js`) routes every call to
  `window.mockFetch` in `js/mock-data.js`, which serves fixtures from `data/*.json`
  through a small route table. No backend needed.
- `mockMode: false` — `apiFetch` makes a real `fetch()` to `apiBaseUrl`.

`js/utils.js`'s `apiFetch` is the only place `mockMode` is read; `js/api-client.js`
is a thin named-endpoint facade over it. Flipping the flag is the only change
needed to switch modes.

## Structure

```
*.html          One page per file, e.g. dashboard.html, leave-apply.html, hr-employees.html
components/     header.html, sidebar.html — injected into pages at runtime by js/loader.js
css/styles.css  Single stylesheet
config.json      Per-machine runtime config (copy from config.json.example)
data/*.json      Mock-mode fixtures, loaded by js/mock-data.js
js/config.js     Loads config.json → window.AppConfig
js/utils.js      Shared helpers + apiFetch (the one fetch wrapper)
js/api-client.js Named-endpoint facade over apiFetch
js/mock-data.js  Mock request router (mockMode)
js/api/         One script per page, paired by name with its .html file
js/*.js         Other shared helpers (auth-guard, csv-export, status-badge, etc.)
js/*.test.js    Plain node test files, colocated with the module they test
```

Pages are grouped by role: `hr-*.html` (HR), `manager-*.html` (managers), the rest are shared/employee-facing.

## Tests

Each `js/*.test.js` file is a standalone node script (asserts + `console.log`, no test runner):

```
node js/list-filter.test.js
node js/request-filter.test.js
node js/parse-delimited.test.js
node js/team-roster.test.js
node js/eval-categories.test.js
node js/appraisal-status.test.js
node js/password-checks.test.js
node js/directory-scope.test.js
```

Or all of them: `for f in js/*.test.js; do node "$f"; done`

## Docs

- `flow.md` — page/user flows
- `discussion.md` — design decisions and rationale
