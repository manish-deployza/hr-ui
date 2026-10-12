/* Employee Directory page. Read only: people are created by invite and edited
 * from the Employees screen (employee-onboarding.md). Read access is tiered
 * (ORG / REPORTS / SELF) and resolved server-side; ORG_ADMIN and HR also
 * receive the personal / address / emergency / pay block, with bank and ID
 * numbers masked to the last 4. Everything this file hides is a convenience -
 * the server decides what each caller gets. */

/* The detail view, as data. Each section is [title, sensitive, rows], and
 * each row is [label, field] or [label, field, formatter]. Sections marked
 * sensitive are skipped entirely unless the payload actually carries
 * sensitive keys, so a non-ORG_ADMIN never even sees the headings. */
const DIR_DETAIL_SECTIONS = [
  ["Identity", false, [
    ["Employee ID", "employeeCode"],
    ["Work email", "email"],
    ["Work phone", "phone"],
  ]],
  ["Employment", false, [
    ["Job title", "designation"],
    ["Department", "department"],
    ["Employment type", "employeeType"],
    ["Status", "status", (v) => (v ? String(v).replace(/_/g, " ") : null)],
    ["Date of joining", "dateOfJoining", formatDate],
    ["Work anniversary", "dateOfJoining", workAnniversary],
  ]],
  ["Organization", false, [
    ["Work location", "workLocation"],
    ["Reporting manager", "managerId", dirManagerName],
    // Derived from the manager chain, not a stored column.
    ["Skip-level manager", "__skip", dirManagerName],
  ]],
  ["Personal", true, [
    ["Date of birth", "dateOfBirth", formatDate],
    ["Birthday", "dateOfBirth", dirBirthdayOnly],
    ["Gender", "gender"],
    ["Nationality", "nationality", countryName],
    ["Marital status", "maritalStatus"],
    ["Blood group", "bloodGroup"],
    ["Personal email", "personalEmail"],
  ]],
  ["Home address", true, [
    ["Address", "__address"],
    ["Emergency contact", "__emergency"],
  ]],
  ["Pay & identifiers", true, [
    ["Basic salary", "basicSalary", (v) => (v == null ? null : Number(v).toLocaleString())],
    ["Bank account", "bankAccount", maskTail],
    ["IFSC / routing", "bankIfsc"],
    ["National ID", "nationalId", maskTail],
    ["Tax ID", "taxId", maskTail],
    ["Passport", "passport", maskTail],
  ]],
];

// Up to 200 rows in the caller's own scope. Used for manager names,
// department suggestions and the filter dropdowns — the table itself is
// paged separately, so a manager on page 3 still resolves to a name.
// ponytail: 200 is the endpoint's max page size, so past 200 people in scope
// a manager outside that slice degrades to "Not visible to you". Swap this
// for a dedicated /directory/managers lookup when an org gets that big.
let dirRoster = [];
// The rows currently on screen. Detail and Edit read from here first so they
// work on any page, not just within the roster slice above.
let dirCurrentRows = [];
let dirPageNo = 0;
let dirScope = "SELF";
let dirDetailModal = null;

document.addEventListener("session-ready", function (ev) {
  dirInit(ev.detail);
});

function dirInit(session) {
  apiClient
    .directory({ page: 0, size: 200 })
    .then(function (result) {
      dirRoster = result.content || [];
      dirScope = resolveDirectoryScope(session, dirRoster);
      dirRenderScopeNote(dirRoster.length);
      dirPopulateDepartments();
      dirPopulateManagers();
      return dirLoadPage();
    })
    .catch(dirFailList);
}

/* ------------------------------------------------------------------
 * List
 * ------------------------------------------------------------------ */

function dirFilters() {
  const filters = {
    page: dirPageNo,
    size: 20,
  };
  const search = document.getElementById("dir-filter-search").value.trim();
  const department = document.getElementById("dir-filter-department").value;
  // managerId is admin-only server-side and 403s for anyone else, so it is
  // only ever sent when the (admin-only) control is actually on the page.
  const managerId = dirScope === "ORG" ? document.getElementById("dir-filter-manager").value : "";
  if (search) filters.search = search;
  if (department) filters.department = department;
  if (managerId) filters.managerId = managerId;
  return filters;
}

function dirLoadPage(isRetry) {
  return apiClient
    .directory(dirFilters())
    .then(function (result) {
      // Landed past the end — deactivating the last row on the last page, or
      // any change that shrank the result set. Step back to the last real
      // page instead of showing an empty table. Guarded so a server that
      // keeps reporting an out-of-range page can't loop.
      const rows = result.content || [];
      if (!rows.length && result.totalElements > 0 && result.number > 0 && !isRetry) {
        dirPageNo = Math.max((result.totalPages || 1) - 1, 0);
        return dirLoadPage(true);
      }
      dirCurrentRows = rows;
      dirRenderRows(rows);
      dirRenderPager(result);
    })
    .catch(dirFailList);
}

function dirFailList(err) {
  document.getElementById("dir-body").innerHTML =
    '<tr><td colspan="5" class="text-center text-danger py-4">' +
    esc((err && err.message) || "Could not load the directory.") +
    "</td></tr>";
  reportApiError(err);
}

function dirManagerName(managerId) {
  if (managerId == null) return "—";
  const manager = dirRoster.find((e) => e.id === managerId);
  // In a REPORTS or SELF view the manager may sit outside what this caller
  // can see. Say so rather than rendering a bare id or a blank cell.
  return manager ? manager.name || "(no name)" : "Not visible to you";
}

function dirRenderRows(rows) {
  if (!rows.length) {
    document.getElementById("dir-body").innerHTML =
      '<tr><td colspan="5" class="text-center text-body-secondary py-4">No matching employees.</td></tr>';
    return;
  }
  document.getElementById("dir-body").innerHTML = rows
    .map(function (r) {
      return (
        "<tr>" +
        '<td><a href="#" data-dir-view="' + r.id + '">' + esc(r.name || "(no name)") + "</a>" +
        (r.status && r.status !== "ACTIVE" ? " " + renderEmployeeStatusBadge(r.status) : "") +
        "</td>" +
        "<td>" + esc(r.employeeCode || "—") + "</td>" +
        "<td>" + esc(r.designation || "—") + "</td>" +
        "<td>" + esc(r.department || "—") + "</td>" +
        "<td>" + esc(dirManagerName(r.managerId)) + "</td>" +
        "</tr>"
      );
    })
    .join("");
}

// Prev / "Page X of Y" / Next — three controls instead of a numbered strip,
// which would need its own windowing logic for no extra reach.
function dirRenderPager(result) {
  const total = result.totalElements || 0;
  const pages = result.totalPages || 1;
  const from = total ? result.number * result.size + 1 : 0;
  const to = Math.min(from + (result.content || []).length - 1, total);

  document.getElementById("dir-count").textContent = total
    ? "Showing " + from + "–" + to + " of " + total + " employee(s)"
    : "No employees to show";

  const item = (label, targetPage, disabled, isLabel) =>
    '<li class="page-item' + (disabled ? " disabled" : "") + (isLabel ? " active" : "") + '">' +
    (isLabel
      ? '<span class="page-link">' + label + "</span>"
      : '<button type="button" class="page-link" data-dir-page="' + targetPage + '">' + label + "</button>") +
    "</li>";

  document.getElementById("dir-pagination").innerHTML =
    item('<i class="bi bi-chevron-left"></i><span class="visually-hidden">Previous</span>', result.number - 1, result.number <= 0) +
    item("Page " + (result.number + 1) + " of " + pages, null, false, true) +
    item('<i class="bi bi-chevron-right"></i><span class="visually-hidden">Next</span>', result.number + 1, result.number >= pages - 1);
}

function dirRenderScopeNote(count) {
  const note =
    dirScope === "ORG"
      ? "Showing everyone in your organization."
      : dirScope === "REPORTS"
        ? "Showing your " + count + " direct report(s). Ask HR for a wider view."
        : "Showing your own record. Ask HR for a wider view.";
  document.getElementById("dir-scope-note").textContent = note;
  document.getElementById("dir-filter-manager-wrap").hidden = dirScope !== "ORG";
}

function dirPopulateDepartments() {
  const departments = Array.from(new Set(dirRoster.map((e) => e.department).filter(Boolean))).sort();
  const options = departments.map((d) => '<option value="' + esc(d) + '">' + esc(d) + "</option>").join("");
  document.getElementById("dir-filter-department").innerHTML = '<option value="">All departments</option>' + options;
}

// Month and day only — the birth YEAR never leaves the sensitive block, so a
// colleague-facing birthday can be shown without disclosing age.
function dirBirthdayOnly(dateOfBirth) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth || "");
  if (!parts) return null;
  return new Date(2000, Number(parts[2]) - 1, Number(parts[3])).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

function dirPopulateManagers() {
  const options = managersOf(dirRoster)
    .map((m) => '<option value="' + m.id + '">' + esc(m.name || "(no name)") + "</option>")
    .join("");
  document.getElementById("dir-filter-manager").innerHTML = '<option value="">All managers</option>' + options;
}

// On-screen page first, then the roster slice - so Detail works for a row on
// page 5 even though the roster only holds the first 200.
function dirFindRow(id) {
  return dirCurrentRows.find((e) => e.id === id) || dirRoster.find((e) => e.id === id) || null;
}

/* ------------------------------------------------------------------
 * Detail
 * ------------------------------------------------------------------ */

function dirGetDetailModal() {
  if (!dirDetailModal) dirDetailModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("dir-detail-modal"));
  return dirDetailModal;
}

/* Pseudo-fields: values the record doesn't store, assembled from what it
 * does. `__` marks them so the section table can list them like any other
 * row without a column existing anywhere. */
function dirPseudoField(name, row) {
  if (name === "__skip") return skipLevelManagerId(dirRoster, row.id);
  if (name === "__address") {
    const line = [row.address1, row.address2, row.landmark].filter(Boolean).join(", ");
    const area = [row.city, row.state, row.postalCode].filter(Boolean).join(" ");
    const parts = [line, area, countryName(row.country)].filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  }
  if (name === "__emergency") {
    if (!row.emergencyName && !row.emergencyPhone) return null;
    const who = [row.emergencyName, row.emergencyRelationship && "(" + row.emergencyRelationship + ")"]
      .filter(Boolean)
      .join(" ");
    return [who, row.emergencyPhone].filter(Boolean).join(" · ");
  }
  return null;
}

function dirRenderDetail(row) {
  // The payload only carries sensitive keys for an ORG_ADMIN, so their
  // presence is what decides whether those sections render at all.
  const hasSensitive = DIRECTORY_SENSITIVE_FIELDS.some((f) => f in row);

  let html = "";
  DIR_DETAIL_SECTIONS.forEach(function (section) {
    const title = section[0];
    const sensitive = section[1];
    if (sensitive && !hasSensitive) return;

    const rows = section[2]
      .map(function (spec) {
        const label = spec[0];
        const field = spec[1];
        const format = spec[2];
        const raw = field.indexOf("__") === 0 ? dirPseudoField(field, row) : row[field];
        let value = format ? format(raw) : raw;
        if (value === null || value === undefined || value === "") value = "—";
        // white-space:pre-line so the assembled address keeps its newlines.
        return (
          '<dt class="col-5">' + esc(label) + "</dt>" +
          '<dd class="col-7 text-break" style="white-space: pre-line">' +
          esc(value) +
          "</dd>"
        );
      })
      .join("");

    html +=
      '<h3 class="h6 mt-3 mb-2 pb-1 border-bottom' +
      (sensitive ? " text-danger" : "") +
      '">' +
      (sensitive ? '<i class="bi bi-lock-fill small"></i> ' : "") +
      esc(title) +
      "</h3>" +
      '<dl class="row mb-0">' + rows + "</dl>";
  });

  if (hasSensitive) {
    html +=
      '<p class="form-text mt-3 mb-0"><i class="bi bi-info-circle"></i> ' +
      "Account numbers and government IDs are shown as their last 4 characters only. " +
      "To change anything, use Edit details on the Employees screen." +
      "</p>";
  }
  document.getElementById("dir-detail-body").innerHTML = html;
}

function dirOpenDetail(id) {
  const row = dirFindRow(id);
  if (!row) return;
  document.getElementById("dir-detail-title").textContent = row.name || "(no name)";
  dirRenderDetail(row);
  dirGetDetailModal().show();
}

/* ------------------------------------------------------------------
 * Wiring — delegated, so it survives the table being re-rendered.
 * ------------------------------------------------------------------ */

function dirWireEvents() {
  document.getElementById("dir-body").addEventListener("click", function (ev) {
    const view = ev.target.closest("[data-dir-view]");
    if (view) {
      ev.preventDefault();
      dirOpenDetail(Number(view.getAttribute("data-dir-view")));
      return;
    }
  });

  document.getElementById("dir-pagination").addEventListener("click", function (ev) {
    const btn = ev.target.closest("[data-dir-page]");
    if (!btn) return;
    dirPageNo = Number(btn.getAttribute("data-dir-page"));
    dirLoadPage();
  });

  // Any filter change resets to page 1 — staying on page 4 of a result set
  // that now has two pages shows an empty table for no reason.
  ["dir-filter-search", "dir-filter-department", "dir-filter-manager"].forEach(function (id) {
    const el = document.getElementById(id);
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", function () {
      dirPageNo = 0;
      dirLoadPage();
    });
  });
}
