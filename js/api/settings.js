/* Org settings screen. GET /organization fills the form; PATCH sends only
 * the editable fields (name) — see Prompts/multi-tenancy.md.
 * Blank values clear them server-side. */

document.addEventListener("session-ready", function (e) {
  if (e.detail.role !== "ORG_ADMIN") {
    window.location.replace("dashboard.html");
    return;
  }
  apiClient.organization().then((org) => {
    document.getElementById("org-key").value = org.orgKey;
    document.getElementById("org-status").value = org.status;
    document.getElementById("org-name").value = org.name || "";
  });
});

document.getElementById("org-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const errorEl = document.getElementById("org-error");
  errorEl.hidden = true;

  const payload = {
    name: normalizeText(document.getElementById("org-name").value),
  };

  withSubmitDisabled(
    e.target,
    apiClient
      .updateOrganization(payload)
      .then(() => {
        // Reload so the form and the header org name both re-fetch and show
        // the persisted values.
        window.location.reload();
      })
      .catch((err) => {
        errorEl.textContent = err.message || "Could not save changes.";
        errorEl.hidden = false;
      })
  );
});
