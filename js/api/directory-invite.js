/* Org Admin -> Employee Directory: invite one user (POST /admin/users) or many
 * (POST /hr/employees/import). ORG_ADMIN only; the server re-authorizes. Moved
 * here from the Employees screen so user creation lives in the Org Admin section. */

const inviteToast = (msg) => showToast(msg, "success");

/* ------------------------------------------------------------------
 * Invite user (ORG_ADMIN) - POST /admin/users. Feedback stays inside the
 * modal: the page-level alerts render behind an open modal.
 * ------------------------------------------------------------------ */
const inviteForm = document.getElementById("invite-form");
const inviteError = document.getElementById("invite-error");

document.getElementById("invite-modal").addEventListener("show.bs.modal", function () {
  inviteForm.reset();
  inviteError.hidden = true;
});

inviteForm.addEventListener("submit", function (ev) {
  ev.preventDefault();
  inviteError.hidden = true;
  const name = document.getElementById("invite-name").value.trim();
  const email = normalizeEmail(document.getElementById("invite-email").value);
  apiClient
    .inviteUser({ name, email, role: document.getElementById("invite-role").value })
    .then(() => {
      bootstrap.Modal.getOrCreateInstance(document.getElementById("invite-modal")).hide();
      inviteToast("Invite sent to " + email + ".");
      dirInit(window.__session);
    })
    .catch((err) => {
      // 409 = duplicate email in the org or seat limit reached; the summary says which.
      inviteError.textContent = err.message || "Could not send the invite.";
      inviteError.hidden = false;
    });
});

// "Manager" isn't a role (role is EMPLOYEE/HR only, per
// 02-database-schema.md) — a "managerEmail" column names who this row
// reports to. The backend resolves it server-side on import; this lookup is
// only for the preview table, so HR can eyeball a bad email before uploading.
function resolveBulkUploadManager(rawEmail) {
  if (!rawEmail) return null;
  return dirRoster.find((e) => e.email && e.email.toLowerCase() === rawEmail.trim().toLowerCase()) || null;
}

function resetBulkUploadModal() {
  document.getElementById("bulk-upload-form").reset();
  document.getElementById("bulk-upload-form").hidden = false;
  document.getElementById("bulk-upload-preview-wrap").hidden = true;
  document.getElementById("bulk-upload-error").hidden = true;
  document.getElementById("bulk-upload-results").hidden = true;
  document.getElementById("bulk-upload-submit-btn").hidden = false;
  document.getElementById("bulk-upload-cancel-btn").textContent = "Cancel";
}

document.getElementById("bulk-upload-trigger").addEventListener("click", resetBulkUploadModal);

// Preview parsed rows as soon as a file is chosen, before "Upload" sends
// anything — lets HR eyeball the data (and catch an unresolved manager) first.
document.getElementById("bulk-upload-file").addEventListener("change", function () {
  const file = this.files[0];
  const wrap = document.getElementById("bulk-upload-preview-wrap");
  const body = document.getElementById("bulk-upload-preview-body");
  const modalError = document.getElementById("bulk-upload-error");
  modalError.hidden = true;
  if (!file) {
    wrap.hidden = true;
    return;
  }

  file.text().then((text) => {
    const rows = parseDelimited(text);
    if (!rows.length) {
      wrap.hidden = true;
      modalError.textContent = "No rows found in file.";
      modalError.hidden = false;
      return;
    }
    // A blank or non-EMPLOYEE/HR role isn't defaulted or skipped by
    // the import endpoint — it fails JSON parsing and voids the WHOLE batch
    // (verified against /hr/employees/import directly), so flag it here
    // rather than silently coalescing it to "EMPLOYEE" like the old preview did.
    let badRoleCount = 0;
    const missingNameCount = rows.filter((r) => !(r.name || "").trim()).length;
    body.innerHTML = rows
      .map((r) => {
        const manager = resolveBulkUploadManager(r.managerEmail);
        const roleRaw = (r.role || "").trim().toUpperCase();
        const roleValid = roleRaw === "EMPLOYEE" || roleRaw === "HR";
        if (!roleValid) badRoleCount++;
        const roleCell = roleValid
          ? esc(roleRaw)
          : '<span class="text-danger">' + esc(roleRaw || "(blank)") + " — invalid</span>";
        return (
          "<tr>" +
          "<td>" + esc(r.name) + "</td>" +
          "<td>" + esc(r.email) + "</td>" +
          "<td>" + roleCell + "</td>" +
          "<td>" + (r.managerEmail ? esc(manager ? manager.name : r.managerEmail + " (not found)") : "—") + "</td>" +
          "</tr>"
        );
      })
      .join("");
    document.getElementById("bulk-upload-preview-count").textContent =
      rows.length + " row(s) found" + (missingNameCount ? " - " + missingNameCount + " without a name (name is required)" : "") + (badRoleCount ? " — " + badRoleCount + " with an invalid role (this will void the entire upload):" : ":");
    wrap.hidden = false;
  });
});

function showBulkUploadResults(result, totalRows) {
  document.getElementById("bulk-upload-form").hidden = true;
  document.getElementById("bulk-upload-results").hidden = false;
  document.getElementById("bulk-upload-submit-btn").hidden = true;
  document.getElementById("bulk-upload-cancel-btn").textContent = "Close";

  const created = result.created || 0;
  document.getElementById("bulk-upload-summary").textContent =
    "Invited " + created + " of " + totalRows + " user(s). Each gets an email to set a password and complete onboarding.";

  const skipped = result.skipped || [];
  const skippedWrap = document.getElementById("bulk-upload-skipped-wrap");
  skippedWrap.hidden = !skipped.length;
  document.getElementById("bulk-upload-skipped-list").innerHTML = skipped.map((reason) => "<li>" + esc(reason) + "</li>").join("");
}

document.getElementById("bulk-upload-form").addEventListener("submit", function (ev) {
  ev.preventDefault();
  const file = document.getElementById("bulk-upload-file").files[0];
  if (!file) return;

  // The Upload button lives in the modal footer, outside the form, so the
  // page-level showError() would render behind the open modal — feedback goes
  // to an alert inside the modal instead.
  const modalError = document.getElementById("bulk-upload-error");
  const uploadBtn = document.getElementById("bulk-upload-submit-btn");
  const failInModal = (msg) => {
    modalError.textContent = msg;
    modalError.hidden = false;
  };
  modalError.hidden = true;
  if (uploadBtn) uploadBtn.disabled = true;

  file
    .text()
    .then((text) => {
      const rows = parseDelimited(text);
      if (!rows.length) {
        failInModal("No rows found in file.");
        return;
      }
      // rows go through as parsed — the import endpoint resolves managerEmail
      // and every other column server-side (see API-REQUIREMENTS.md); the
      // frontend no longer builds a per-row payload or derives managerId.
      return apiClient.importHrEmployees(rows).then((result) => {
        showBulkUploadResults(result, rows.length);
        dirInit(window.__session);
      });
    })
    .catch((err) => {
      const summary = (err && err.body && err.body.summary) || err.message || "";
      // A bad `role` value (blank, or anything but EMPLOYEE/HR) fails
      // JSON body parsing server-side, which rejects the WHOLE batch with
      // this generic message before any row-level validation runs — verified
      // against /hr/employees/import directly. No skipped-row reason comes
      // back for this case, so name it here instead of showing raw summary.
      const msg = /malformed request body/i.test(summary)
        ? "The file was rejected — check that every row's role is exactly EMPLOYEE or HR (blank or any other value voids the whole batch, not just that row)."
        : summary || "Could not process the file.";
      failInModal(msg);
    })
    .finally(() => {
      if (uploadBtn) uploadBtn.disabled = false;
    });
});

