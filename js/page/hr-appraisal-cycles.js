document.addEventListener("session-ready", function () {
  loadCycles();
  loadRatingValues();

  const cycleModal = new bootstrap.Modal(document.getElementById("cycle-modal"));
  const ratingModal = new bootstrap.Modal(document.getElementById("rating-modal"));

  document.getElementById("new-cycle-form").addEventListener("submit", function (e) {
    e.preventDefault();
    apiClient
      .createAppraisalCycle({
        name: normalizeText(document.getElementById("cycle-name").value),
        startDate: document.getElementById("cycle-start").value,
        endDate: document.getElementById("cycle-end").value,
        selfReviewDeadline: document.getElementById("cycle-self-deadline").value,
        managerReviewDeadline: document.getElementById("cycle-manager-deadline").value,
      })
      .then(() => {
        e.target.reset();
        cycleModal.hide();
        loadCycles();
      })
      .catch(showCyclesError);
  });

  document.getElementById("new-rating-form").addEventListener("submit", function (e) {
    e.preventDefault();
    apiClient
      .createAppraisalRatingValue({
        value: Number(document.getElementById("rating-value").value),
        label: normalizeText(document.getElementById("rating-label").value),
      })
      .then(() => {
        e.target.reset();
        ratingModal.hide();
        loadRatingValues();
      })
      .catch(showCyclesError);
  });
});

function loadCycles() {
  apiClient
    .hrAppraisalCycles()
    .then((cycles) => {
      document.getElementById("cycles-body").innerHTML = cycles.length
        ? cycles
            .map(
              (c) =>
                "<tr>" +
                "<td>" + esc(c.name) + "</td>" +
                "<td>" + formatDate(c.startDate) + " – " + formatDate(c.endDate) + "</td>" +
                "<td>" + formatDate(c.selfReviewDeadline) + "</td>" +
                "<td>" + formatDate(c.managerReviewDeadline) + "</td>" +
                "<td>" + renderBadge(c.status, APPRAISAL_CYCLE_STATUS_BADGE_MAP) + "</td>" +
                "<td>" + cycleActionButton(c) + "</td>" +
                "</tr>"
            )
            .join("")
        : '<tr><td colspan="6" class="text-center text-body-secondary py-4">No cycles yet.</td></tr>';

      document.querySelectorAll("[data-open-cycle]").forEach((btn) => {
        btn.addEventListener("click", () => apiClient.openAppraisalCycle(btn.getAttribute("data-open-cycle")).then(loadCycles).catch(showCyclesError));
      });
      document.querySelectorAll("[data-close-cycle]").forEach((btn) => {
        btn.addEventListener("click", () => apiClient.closeAppraisalCycle(btn.getAttribute("data-close-cycle")).then(loadCycles).catch(showCyclesError));
      });
    })
    .catch(showCyclesError);
}

function cycleActionButton(cycle) {
  if (cycle.status === "DRAFT") return '<button class="btn btn-sm btn-outline-primary" data-open-cycle="' + cycle.id + '">Open</button>';
  if (cycle.status === "OPEN") return '<button class="btn btn-sm btn-outline-danger" data-close-cycle="' + cycle.id + '">Close</button>';
  return "";
}

function loadRatingValues() {
  apiClient.hrAppraisalRatingValues().then((values) => {
    document.getElementById("rating-values-body").innerHTML = values.length
      ? values
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((v) => "<tr><td>" + esc(v.value) + "</td><td>" + esc(v.label) + "</td></tr>")
          .join("")
      : '<tr><td colspan="2" class="text-center text-body-secondary py-4">No rating scale configured.</td></tr>';
  });
}

function showCyclesError(err) {
  const errorEl = document.getElementById("cycles-error");
  errorEl.textContent = err.message || "Could not save the change.";
  errorEl.hidden = false;
}
