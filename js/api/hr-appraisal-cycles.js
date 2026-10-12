let allCycles = [];
let categoriesModal = null;
let rosterModal = null;
let levelsModal = null;
let returnModal = null;
let calibrationModal = null;
let editingCategoriesCycleId = null;
let editingCategories = [];
let nextCategoryId = 1;
let viewingRosterCycleId = null;
let returningAppraisalId = null;
let viewingCalibrationCycleId = null;
let editingLevels = [];
let nextLevelId = 1;

document.addEventListener("session-ready", function () {
  loadCycles();
  loadRatingValues();
  loadLevels();

  const cycleModal = new bootstrap.Modal(document.getElementById("cycle-modal"));
  const ratingModal = new bootstrap.Modal(document.getElementById("rating-modal"));
  categoriesModal = new bootstrap.Modal(document.getElementById("categories-modal"));
  rosterModal = new bootstrap.Modal(document.getElementById("roster-modal"));
  returnModal = new bootstrap.Modal(document.getElementById("return-modal"));
  calibrationModal = new bootstrap.Modal(document.getElementById("calibration-modal"));
  levelsModal = new bootstrap.Modal(document.getElementById("levels-modal"));

  document.getElementById("new-cycle-form").addEventListener("submit", function (e) {
    e.preventDefault();
    withSubmitDisabled(
      e.target,
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
        .catch(showCyclesError)
    );
  });

  document.getElementById("new-rating-form").addEventListener("submit", function (e) {
    e.preventDefault();
    withSubmitDisabled(
      e.target,
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
        .catch(showCyclesError)
    );
  });

  document.getElementById("cycles-body").addEventListener("click", function (ev) {
    const openBtn = ev.target.closest("[data-open-cycle]");
    if (openBtn) {
      apiClient.openAppraisalCycle(openBtn.getAttribute("data-open-cycle")).then(loadCycles).catch(showCyclesError);
      return;
    }
    const closeBtn = ev.target.closest("[data-close-cycle]");
    if (closeBtn) {
      const cycleName = closeBtn.closest("tr").querySelector("td").textContent;
      confirmDanger(
        'Close the "' + cycleName + '" cycle? Finalized and acknowledged reviews will be closed. This cannot be undone.',
        "Close cycle"
      ).then(function (confirmed) {
        if (!confirmed) return;
        apiClient.closeAppraisalCycle(closeBtn.getAttribute("data-close-cycle")).then(loadCycles).catch(showCyclesError);
      });
      return;
    }
    const categoriesBtn = ev.target.closest("[data-edit-categories]");
    if (categoriesBtn) {
      openCategoriesModal(Number(categoriesBtn.getAttribute("data-edit-categories")));
      return;
    }
    const rosterBtn = ev.target.closest("[data-view-roster]");
    if (rosterBtn) {
      openRosterModal(Number(rosterBtn.getAttribute("data-view-roster")));
      return;
    }
    const calibrationBtn = ev.target.closest("[data-view-calibration]");
    if (calibrationBtn) {
      openCalibrationModal(Number(calibrationBtn.getAttribute("data-view-calibration")));
    }
  });

  document.getElementById("add-cycle-category-btn").addEventListener("click", function () {
    editingCategories.push(newCategory("cat-" + nextCategoryId++, ""));
    renderCategoriesEditor();
  });

  document.getElementById("load-standard-schema-btn").addEventListener("click", function () {
    editingCategories = standardCategories();
    renderCategoriesEditor();
  });

  document.getElementById("save-cycle-categories").addEventListener("click", function () {
    if (!editingCategoriesCycleId) return;
    apiClient
      .updateAppraisalCycleCategories(editingCategoriesCycleId, editingCategories)
      .then(() => {
        categoriesModal.hide();
        loadCycles();
      })
      .catch(reportApiError);
  });

  document.getElementById("levels-modal").addEventListener("show.bs.modal", function () {
    apiClient
      .hrAppraisalPerformanceLevels()
      .then((levels) => {
        editingLevels = levels.map((l) => Object.assign({}, l));
        nextLevelId = Math.max(1, editingLevels.reduce((max, l) => Math.max(max, typeof l.id === "number" ? l.id : 0), 0)) + 1;
        renderLevelsEditor();
      })
      .catch(reportApiError);
  });

  document.getElementById("add-level-btn").addEventListener("click", function () {
    editingLevels.push({ id: "new-" + nextLevelId++, minScore: 0, maxScore: 0, label: "" });
    renderLevelsEditor();
  });

  document.getElementById("levels-editor").addEventListener("click", function (ev) {
    const removeBtn = ev.target.closest("[data-level-remove]");
    if (!removeBtn) return;
    editingLevels = editingLevels.filter((l) => String(l.id) !== removeBtn.getAttribute("data-level-remove"));
    renderLevelsEditor();
  });

  document.getElementById("levels-editor").addEventListener("input", function (ev) {
    const field = ev.target.getAttribute("data-level-field");
    const id = ev.target.getAttribute("data-level-id");
    if (!field || !id) return;
    const level = editingLevels.find((l) => String(l.id) === id);
    if (level) level[field] = field === "label" ? ev.target.value : Number(ev.target.value);
  });

  document.getElementById("save-levels").addEventListener("click", function () {
    apiClient
      .updateAppraisalPerformanceLevels(editingLevels)
      .then(() => {
        levelsModal.hide();
        loadLevels();
      })
      .catch(reportApiError);
  });

  document.getElementById("return-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!returningAppraisalId) return;
    const reason = normalizeText(document.getElementById("return-reason").value);
    withSubmitDisabled(
      ev.target,
      apiClient
        .returnAppraisalToManager(returningAppraisalId, reason)
        .then(() => {
          ev.target.reset();
          returnModal.hide();
          loadRoster(viewingRosterCycleId);
        })
        .catch(reportApiError)
    );
  });

  document.getElementById("roster-body").addEventListener("click", function (ev) {
    const advanceBtn = ev.target.closest("[data-advance-calibration]");
    if (advanceBtn) {
      apiClient
        .advanceAppraisalToCalibration(advanceBtn.getAttribute("data-advance-calibration"))
        .then(() => loadRoster(viewingRosterCycleId))
        .catch(reportApiError);
      return;
    }
    const finalizeBtn = ev.target.closest("[data-finalize]");
    if (finalizeBtn) {
      apiClient
        .finalizeAppraisal(finalizeBtn.getAttribute("data-finalize"))
        .then(() => loadRoster(viewingRosterCycleId))
        .catch(reportApiError);
      return;
    }
    const returnBtn = ev.target.closest("[data-return]");
    if (returnBtn) {
      returningAppraisalId = returnBtn.getAttribute("data-return");
      document.getElementById("return-reason").value = "";
      returnModal.show();
      return;
    }
    const reopenBtn = ev.target.closest("[data-reopen]");
    if (reopenBtn) {
      apiClient
        .reopenAppraisal(reopenBtn.getAttribute("data-reopen"))
        .then(() => loadRoster(viewingRosterCycleId))
        .catch(reportApiError);
      return;
    }
    const cancelBtn = ev.target.closest("[data-cancel-appraisal]");
    if (cancelBtn) {
      const employeeName = cancelBtn.closest("tr").querySelector("td").textContent;
      confirmDanger(
        "Cancel " + employeeName + "'s appraisal? This is terminal and cannot be undone.",
        "Cancel appraisal"
      ).then(function (confirmed) {
        if (!confirmed) return;
        apiClient
          .cancelAppraisal(cancelBtn.getAttribute("data-cancel-appraisal"))
          .then(() => loadRoster(viewingRosterCycleId))
          .catch(reportApiError);
      });
    }
  });

  document.getElementById("calibration-rows").addEventListener("click", function (ev) {
    const saveBtn = ev.target.closest("[data-calibrate-save]");
    if (!saveBtn) return;
    const id = saveBtn.getAttribute("data-calibrate-save");
    const scoreInput = document.querySelector('[data-calibrate-score="' + id + '"]');
    const reasonInput = document.querySelector('[data-calibrate-reason="' + id + '"]');
    const scoreText = scoreInput.value.trim();
    document.getElementById("calibration-error").hidden = true;
    apiClient
      .calibrateAppraisal(id, {
        calibratedScore: scoreText === "" ? null : Number(scoreText),
        calibrationReason: normalizeText(reasonInput.value),
      })
      .then(() => loadCalibration(viewingCalibrationCycleId))
      .catch((err) => {
        const el = document.getElementById("calibration-error");
        el.textContent = err.message || "Could not save the calibrated score.";
        el.hidden = false;
      });
  });

  document.getElementById("roster-import-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const file = document.getElementById("roster-file").files[0];
    if (!file || !viewingRosterCycleId) return;

    file
      .text()
      .then((text) => {
        const rows = parseDelimited(text);
        if (!rows.length) {
          showRosterError("No rows found in file.");
          return;
        }
        return apiClient.importAppraisalRoster(viewingRosterCycleId, rows).then((result) => {
          ev.target.reset();
          showRosterSuccess(
            "Imported " + result.created + " appraisal(s)." + (result.skipped.length ? " Skipped: " + result.skipped.join("; ") : "")
          );
          loadRoster(viewingRosterCycleId);
        });
      })
      .catch((err) => showRosterError(err.message || "Could not process the file."));
  });
});

function loadCycles() {
  apiClient
    .hrAppraisalCycles()
    .then((cycles) => {
      allCycles = cycles;
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
                '<td class="text-nowrap">' + cycleActionButtons(c) + "</td>" +
                "</tr>"
            )
            .join("")
        : '<tr><td colspan="6" class="text-center text-body-secondary py-4">No cycles yet.</td></tr>';
    })
    .catch(showCyclesError);
}

function cycleActionButtons(cycle) {
  const lifecycleBtn =
    cycle.status === "DRAFT"
      ? '<button class="btn btn-sm btn-outline-primary" data-open-cycle="' + cycle.id + '">Open</button>'
      : cycle.status === "OPEN"
        ? '<button class="btn btn-sm btn-outline-danger" data-close-cycle="' + cycle.id + '">Close</button>'
        : "";
  return (
    '<div class="d-flex gap-1 justify-content-end">' +
    '<button class="btn btn-sm btn-outline-secondary" data-edit-categories="' + cycle.id + '" title="Evaluation categories"><i class="bi bi-list-check"></i></button>' +
    '<button class="btn btn-sm btn-outline-secondary" data-view-roster="' + cycle.id + '" title="Roster"><i class="bi bi-people"></i></button>' +
    '<button class="btn btn-sm btn-outline-secondary" data-view-calibration="' + cycle.id + '" title="Calibration"><i class="bi bi-sliders"></i></button>' +
    lifecycleBtn +
    "</div>"
  );
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

// --- Category template editor ------------------------------------------

function openCategoriesModal(cycleId) {
  const cycle = allCycles.find((c) => c.id === cycleId);
  if (!cycle) return;

  editingCategoriesCycleId = cycleId;
  editingCategories = cloneCategoryTree(cycle.categories || []);
  nextCategoryId = 100;
  document.getElementById("categories-modal-title").textContent = "Evaluation categories — " + cycle.name;
  renderCategoriesEditor();
  categoriesModal.show();
}

document.getElementById("cycle-categories-editor").addEventListener("input", function (ev) {
  const nameId = ev.target.getAttribute("data-cat-name");
  if (nameId) findCategoryNode(nameId, editingCategories).name = ev.target.value;
  const weightId = ev.target.getAttribute("data-cat-weight");
  if (weightId) {
    findCategoryNode(weightId, editingCategories).weight = Number(ev.target.value) || 0;
    renderWeightTotal();
  }
});

document.getElementById("cycle-categories-editor").addEventListener("click", function (ev) {
  const removeBtn = ev.target.closest("[data-cat-remove]");
  if (removeBtn) {
    removeCategoryNode(removeBtn.getAttribute("data-cat-remove"), editingCategories);
    renderCategoriesEditor();
    return;
  }
  const addSubBtn = ev.target.closest("[data-cat-addsub]");
  if (addSubBtn) {
    findCategoryNode(addSubBtn.getAttribute("data-cat-addsub"), editingCategories).subsections.push(newCategory("cat-" + nextCategoryId++, ""));
    renderCategoriesEditor();
  }
});

function renderCategoryEditorNode(node, depth) {
  // Weight only applies at the top level (a section's own contribution to
  // the final score) - sub-sections are just a finer breakdown scored
  // within their parent, see js/eval-categories.js's averageScore().
  const weightInput =
    depth === 0
      ? '<div class="input-group input-group-sm" style="width: 90px;">' +
        '<input type="number" min="0" max="100" class="form-control" data-cat-weight="' + node.id + '" value="' + (node.weight || 0) + '" title="Weight toward the final score">' +
        '<span class="input-group-text">%</span></div>'
      : "";
  return (
    '<div class="card p-2 mb-2 d-flex flex-row align-items-center gap-2" style="margin-left: ' + depth * 24 + 'px;">' +
    '<input type="text" class="form-control form-control-sm" data-cat-name="' + node.id + '" value="' + esc(node.name) + '" placeholder="Category name">' +
    weightInput +
    '<button type="button" class="btn btn-sm btn-outline-secondary text-nowrap" data-cat-addsub="' + node.id + '"><i class="bi bi-plus"></i> Sub-section</button>' +
    '<button type="button" class="btn btn-sm btn-outline-danger" data-cat-remove="' + node.id + '"><i class="bi bi-trash"></i></button>' +
    "</div>" +
    (node.subsections.length ? node.subsections.map((s) => renderCategoryEditorNode(s, depth + 1)).join("") : "")
  );
}

function renderCategoriesEditor() {
  document.getElementById("cycle-categories-editor").innerHTML = editingCategories.length
    ? editingCategories.map((c) => renderCategoryEditorNode(c, 0)).join("")
    : '<p class="text-body-secondary small">No categories yet — add one to define the rubric managers will score against.</p>';
  renderWeightTotal();
}

function renderWeightTotal() {
  const el = document.getElementById("cycle-categories-weight-total");
  const total = editingCategories.reduce((sum, c) => sum + (c.weight || 0), 0);
  if (!total) {
    el.className = "small mt-2 mb-0 text-body-secondary";
    el.textContent = "No weights set — this rubric will be unweighted (no computed final score).";
    return;
  }
  const remaining = 100 - total;
  el.className = "small mt-2 mb-0 " + (remaining === 10 ? "text-success" : "text-warning");
  el.textContent =
    "Category weights total " + total + "%. " +
    (remaining === 10
      ? "The remaining 10% is Manager Overall Assessment — 100% total."
      : "Aim for 90% here so the remaining 10% (Manager Overall Assessment) makes 100%.");
}

// --- Performance levels ---------------------------------------------------

function loadLevels() {
  apiClient.hrAppraisalPerformanceLevels().then((levels) => {
    document.getElementById("levels-body").innerHTML = levels.length
      ? levels
          .slice()
          .sort((a, b) => b.minScore - a.minScore)
          .map((l) => "<tr><td>" + esc(l.minScore) + "</td><td>" + esc(l.maxScore) + "</td><td>" + esc(l.label) + "</td></tr>")
          .join("")
      : '<tr><td colspan="3" class="text-center text-body-secondary py-4">No performance levels configured.</td></tr>';
  });
}

function renderLevelsEditor() {
  document.getElementById("levels-editor").innerHTML = editingLevels.length
    ? editingLevels
        .map(
          (l) =>
            '<div class="card p-2 mb-2 d-flex flex-row align-items-center gap-2">' +
            '<input type="number" step="0.01" class="form-control form-control-sm" style="width: 90px;" data-level-id="' + l.id + '" data-level-field="minScore" value="' + l.minScore + '" placeholder="Min">' +
            '<input type="number" step="0.01" class="form-control form-control-sm" style="width: 90px;" data-level-id="' + l.id + '" data-level-field="maxScore" value="' + l.maxScore + '" placeholder="Max">' +
            '<input type="text" class="form-control form-control-sm" data-level-id="' + l.id + '" data-level-field="label" value="' + esc(l.label) + '" placeholder="Label">' +
            '<button type="button" class="btn btn-sm btn-outline-danger" data-level-remove="' + l.id + '"><i class="bi bi-trash"></i></button>' +
            "</div>"
        )
        .join("")
    : '<p class="text-body-secondary small">No levels yet — add one.</p>';
}

// --- Roster --------------------------------------------------------------

function openRosterModal(cycleId) {
  const cycle = allCycles.find((c) => c.id === cycleId);
  if (!cycle) return;

  viewingRosterCycleId = cycleId;
  document.getElementById("roster-modal-title").textContent = "Roster — " + cycle.name;
  document.getElementById("roster-error").hidden = true;
  document.getElementById("roster-success").hidden = true;
  loadRoster(cycleId);
  rosterModal.show();
}

function loadRoster(cycleId) {
  apiClient.hrAppraisalsForCycle(cycleId).then((rows) => {
    document.getElementById("roster-body").innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              "<tr>" +
              "<td>" + esc(r.employeeName) + "</td>" +
              "<td>" + esc(r.department || "—") + "</td>" +
              "<td>" + esc(r.managerName || "—") + "</td>" +
              "<td>" + renderBadge(r.status, APPRAISAL_STATUS_BADGE_MAP) + "</td>" +
              "<td>" + esc(r.selfRatingLabel || "—") + "</td>" +
              "<td>" + esc(r.managerRatingLabel || "—") + "</td>" +
              "<td>" + (r.finalScore != null ? r.finalScore.toFixed(2) : "—") + "</td>" +
              "<td>" + esc(r.performanceLevel || "—") + "</td>" +
              '<td class="text-nowrap">' + rosterActionButtons(r) + " " +
              '<a href="appraisal-view.html?id=' + encodeURIComponent(r.id) + '" target="_blank" rel="noopener">Open</a></td>' +
              "</tr>"
          )
          .join("")
      : '<tr><td colspan="9" class="text-center text-body-secondary py-4">No one enrolled yet — import a roster above.</td></tr>';
  });
}

// State-machine-driven per row - js/appraisal-status.js. The score
// comparison itself (self/manager/calibrated, department averages) lives in
// the separate Calibration popup below - these buttons only move status
// through HR_REVIEW -> CALIBRATION -> FINALIZED.
function rosterActionButtons(r) {
  const buttons = [];
  if (r.status === "HR_REVIEW") {
    buttons.push('<button type="button" class="btn btn-sm btn-outline-primary" data-advance-calibration="' + r.id + '">Calibrate</button>');
    buttons.push('<button type="button" class="btn btn-sm btn-outline-warning" data-return="' + r.id + '">Return</button>');
  }
  if (r.status === "CALIBRATION") {
    buttons.push('<button type="button" class="btn btn-sm btn-outline-primary" data-finalize="' + r.id + '">Finalize</button>');
  }
  if (canReopenAppraisal(r.status)) {
    buttons.push('<button type="button" class="btn btn-sm btn-outline-secondary" data-reopen="' + r.id + '">Reopen</button>');
  }
  if (r.status === "REOPENED") {
    buttons.push('<button type="button" class="btn btn-sm btn-outline-primary" data-finalize="' + r.id + '">Re-finalize</button>');
  }
  if (canCancelAppraisal(r.status)) {
    buttons.push('<button type="button" class="btn btn-sm btn-outline-danger" data-cancel-appraisal="' + r.id + '">Cancel</button>');
  }
  return buttons.join(" ");
}

// --- Calibration -----------------------------------------------------------

function openCalibrationModal(cycleId) {
  const cycle = allCycles.find((c) => c.id === cycleId);
  if (!cycle) return;

  viewingCalibrationCycleId = cycleId;
  document.getElementById("calibration-modal-title").textContent = "Calibration — " + cycle.name;
  document.getElementById("calibration-error").hidden = true;
  loadCalibration(cycleId);
  calibrationModal.show();
}

function loadCalibration(cycleId) {
  apiClient.hrAppraisalCalibration(cycleId).then((data) => {
    document.getElementById("calibration-departments").innerHTML = data.departmentAverages.length
      ? data.departmentAverages.map((d) => "<tr><td>" + esc(d.department) + "</td><td>" + d.avgScore.toFixed(2) + "</td></tr>").join("")
      : '<tr><td colspan="2" class="text-center text-body-secondary py-3">No scored reviews yet.</td></tr>';

    document.getElementById("calibration-rows").innerHTML = data.rows.length
      ? data.rows.map(renderCalibrationRow).join("")
      : '<tr><td colspan="6" class="text-center text-body-secondary py-3">No reviews with a manager score yet.</td></tr>';
  });
}

function renderCalibrationRow(r) {
  return (
    "<tr>" +
    "<td>" + esc(r.employeeName) + "</td>" +
    "<td>" + (r.selfScore != null ? r.selfScore.toFixed(2) : "—") + "</td>" +
    "<td>" + (r.managerScore != null ? r.managerScore.toFixed(2) : "—") + "</td>" +
    '<td><input type="number" step="0.01" min="0" max="5" class="form-control form-control-sm" style="width: 90px;" data-calibrate-score="' + r.id + '" value="' + (r.calibratedScore != null ? r.calibratedScore : "") + '" placeholder="' + (r.managerScore != null ? r.managerScore.toFixed(2) : "") + '"></td>' +
    '<td><input type="text" class="form-control form-control-sm" data-calibrate-reason="' + r.id + '" value="' + esc(r.calibrationReason || "") + '" placeholder="Required if changed"></td>' +
    '<td><button type="button" class="btn btn-sm btn-outline-primary" data-calibrate-save="' + r.id + '">Save</button></td>' +
    "</tr>"
  );
}

function showRosterError(message) {
  const el = document.getElementById("roster-error");
  el.textContent = message;
  el.hidden = false;
  document.getElementById("roster-success").hidden = true;
}

function showRosterSuccess(message) {
  const el = document.getElementById("roster-success");
  el.textContent = message;
  el.hidden = false;
  document.getElementById("roster-error").hidden = true;
}

function showCyclesError(err) {
  const errorEl = document.getElementById("cycles-error");
  errorEl.textContent = err.message || "Could not save the change.";
  errorEl.hidden = false;
}
