document.addEventListener("session-ready", function () {
  apiClient
    .hrAuditLog()
    .then((entries) => {
      document.getElementById("hr-audit-log-body").innerHTML = entries.length
        ? entries
            .map(
              (a) =>
                "<tr>" +
                "<td>" + formatDate(a.createdAt) + "</td>" +
                "<td>" + esc(a.action) + "</td>" +
                "<td>" + esc(a.entityType) + " #" + esc(a.entityId) + "</td>" +
                "<td>" + esc(a.performedByName || a.performedBy) + "</td>" +
                "</tr>"
            )
            .join("")
        : '<tr><td colspan="4" class="text-center text-body-secondary py-4">No audit entries.</td></tr>';
    })
    .catch((err) => {
      const errorEl = document.getElementById("hr-audit-log-error");
      errorEl.textContent = err.message || "Could not load the audit log.";
      errorEl.hidden = false;
    });
});
