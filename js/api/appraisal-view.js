/* Self-review is employee-only while a.status is SELF_APPRAISAL; the
 * manager section only opens once it's MANAGER_REVIEW (or RETURNED, for a
 * re-edit) - see js/appraisal-status.js / 18-appraisal-enterprise-
 * expansion.md's Appraisal state machine. */

document.addEventListener("session-ready", function (e) {
  const id = qs("id");
  load(e.detail, id);
});

// A self-assessment tree (employee, pre-submission) and a manager-review
// tree (manager, revealed once self is submitted) are both on the page at
// once (each `hidden` until it's that viewer's turn) - each gets its own
// container/list/id-namespace via makeCategoryEditor() so their radio-group
// names (renderCategoryNode()) and node ids never collide, even though both
// are typically seeded from the same cycle template.
function makeCategoryEditor(containerId, addBtnId) {
  let list = [];
  let nextId = 1;
  const container = document.getElementById(containerId);

  function make(name) {
    return newCategory(containerId + "-" + nextId++, name);
  }

  // Delegated on the container (rather than per-node) since the whole
  // subtree gets re-rendered on add/remove — listeners bound to individual
  // nodes would be thrown away with them.
  container.addEventListener("input", function (ev) {
    const nameId = ev.target.getAttribute("data-cat-name");
    if (nameId) {
      findCategoryNode(nameId, list).name = ev.target.value;
      return;
    }
    const commentId = ev.target.getAttribute("data-cat-comment");
    if (commentId) findCategoryNode(commentId, list).comment = ev.target.value;
  });

  container.addEventListener("change", function (ev) {
    const scoreId = ev.target.getAttribute("data-cat-score");
    if (scoreId) findCategoryNode(scoreId, list).score = Number(ev.target.value);
  });

  container.addEventListener("click", function (ev) {
    const removeBtn = ev.target.closest("[data-cat-remove]");
    if (removeBtn) {
      removeCategoryNode(removeBtn.getAttribute("data-cat-remove"), list);
      render();
      return;
    }
    const addSubBtn = ev.target.closest("[data-cat-addsub]");
    if (addSubBtn) {
      findCategoryNode(addSubBtn.getAttribute("data-cat-addsub"), list).subsections.push(make(""));
      render();
    }
  });

  if (addBtnId) {
    document.getElementById(addBtnId).addEventListener("click", function () {
      list.push(make(""));
      render();
    });
  }

  function render() {
    container.innerHTML = list.length
      ? list.map((c) => renderCategoryNode(c, 0)).join("")
      : '<p class="text-body-secondary small">No categories yet — add one to start scoring specific areas.</p>';
  }

  return {
    set: function (l) {
      list = l;
      nextId = 100;
      render();
    },
    get: function () {
      return list;
    },
  };
}

const selfEditor = makeCategoryEditor("self-eval-categories", "add-self-category-btn");
const managerEditor = makeCategoryEditor("eval-categories", "add-category-btn");

function renderCategoryNode(node, depth) {
  // DOM order is 5..1, not 1..5 — combined with .star-rating's row-reverse in
  // css/styles.css, that's what lets the plain CSS ~ sibling selector fill a
  // star and everything to its (visual) left on hover/checked.
  const scoreButtons = [5, 4, 3, 2, 1]
    .map(
      (n) =>
        '<input type="radio" class="star-rating-input" name="score-' + node.id + '" id="score-' + node.id + "-" + n + '" value="' + n + '" data-cat-score="' + node.id + '"' + (node.score === n ? " checked" : "") + ">" +
        '<label class="star-rating-star" for="score-' + node.id + "-" + n + '"><i class="bi bi-star-fill" aria-hidden="true"></i><span class="visually-hidden">' + n + ' star' + (n === 1 ? "" : "s") + "</span></label>"
    )
    .join("");

  return (
    '<div class="card p-2 mb-2" style="margin-left: ' + depth * 24 + 'px;">' +
    '<div class="d-flex align-items-center gap-2 mb-2">' +
    '<input type="text" class="form-control form-control-sm" data-cat-name="' + node.id + '" value="' + esc(node.name) + '" placeholder="Category name">' +
    '<button type="button" class="btn btn-sm btn-outline-secondary text-nowrap" data-cat-addsub="' + node.id + '"><i class="bi bi-plus"></i> Sub-section</button>' +
    '<button type="button" class="btn btn-sm btn-outline-danger" data-cat-remove="' + node.id + '"><i class="bi bi-trash"></i></button>' +
    "</div>" +
    '<div class="star-rating mb-2" role="radiogroup" aria-label="Score">' + scoreButtons + "</div>" +
    '<textarea class="form-control form-control-sm" rows="2" placeholder="Comment" data-cat-comment="' + node.id + '">' + esc(node.comment) + "</textarea>" +
    (node.subsections.length ? '<div class="mt-2">' + node.subsections.map((s) => renderCategoryNode(s, depth + 1)).join("") + "</div>" : "") +
    "</div>"
  );
}

function renderCategoriesSummary(list) {
  if (!list.length) return "";
  return '<h3 class="h6 mt-3">Evaluation categories</h3><ul class="list-group">' + list.map(renderCategorySummaryNode).join("") + "</ul>";
}

function renderScoreDots(score) {
  return (
    '<div class="star-rating-readonly" aria-label="' + (score ? score + " out of 5" : "Not scored") + '">' +
    [1, 2, 3, 4, 5].map((n) => '<i class="bi ' + (score >= n ? "bi-star-fill" : "bi-star") + '" aria-hidden="true"></i>').join("") +
    "</div>"
  );
}

function renderCategorySummaryNode(node) {
  return (
    '<li class="list-group-item">' +
    '<div class="d-flex align-items-center justify-content-between"><strong>' + esc(node.name || "(untitled)") + "</strong>" + renderScoreDots(node.score) + "</div>" +
    (node.comment ? '<div class="text-body-secondary small">' + esc(node.comment) + "</div>" : "") +
    (node.subsections.length ? '<ul class="list-group mt-2">' + node.subsections.map(renderCategorySummaryNode).join("") + "</ul>" : "") +
    "</li>"
  );
}

// Self side has no "overall" component in the final-score formula (only
// Manager Overall Assessment carries the reserved 10%, see
// 18-appraisal-enterprise-expansion.md) - so a self-only weighted score
// structurally can't reach the top of the org's performance-level bands
// (maxes out at whatever % the cycle's categories are weighted to, e.g.
// 4.5/5 if they total 90%). It's shown as an informational figure only, not
// run through performanceLevelFor - that'd misleadingly look like a low
// grade rather than an incomplete-by-design number.
function renderSelfScoreSummary(a) {
  if (a.selfScore == null) return "";
  return '<div class="mt-3 pt-3 border-top"><p class="mb-0"><strong>Self weighted score (categories only):</strong> ' + a.selfScore.toFixed(2) + ' / 5</p></div>';
}

// The manager's computed score, and - once HR has calibrated it (see the
// Calibration popup in hr-appraisal-cycles.html) - the calibrated score
// that actually drives the performance level everywhere else (roster,
// mock-data.js's finalScoreFor). Both mirror the same server-side numbers
// toAppraisalDetail() already computed, not a client-side recomputation.
function renderFinalScoreSummary(a) {
  if (a.managerScore == null) return "";
  const level = performanceLevelFor(a.finalScore, a.performanceLevels);
  const calibrated = a.calibratedScore != null;
  return (
    '<div class="mt-3 pt-3 border-top">' +
    '<p class="mb-1"><strong>Manager score:</strong> ' + a.managerScore.toFixed(2) + " / 5</p>" +
    (calibrated
      ? '<p class="mb-1"><strong>Calibrated by HR:</strong> ' + a.calibratedScore.toFixed(2) + " / 5" + (a.calibrationReason ? " — " + esc(a.calibrationReason) : "") + "</p>"
      : "") +
    '<p class="mb-0"><strong>Final score:</strong> ' + a.finalScore.toFixed(2) + " / 5" + (level ? " — " + esc(level.label) : "") + "</p>" +
    "</div>"
  );
}

function renderLifecycleBanner(a, isEmployee) {
  const el = document.getElementById("appraisal-lifecycle-banner");
  if (a.status === "RETURNED") {
    el.className = "alert alert-warning mb-3";
    el.hidden = false;
    el.innerHTML = "<strong>Returned by HR" + (isEmployee ? "" : " for revision") + ":</strong> " + esc(a.returnReason || "No reason given.");
  } else if (a.status === "REOPENED") {
    el.className = "alert alert-info mb-3";
    el.hidden = false;
    el.textContent = "This appraisal was reopened" + (a.reopenReason ? ": " + a.reopenReason : " for correction.");
  } else if (a.status === "CANCELLED") {
    el.className = "alert alert-secondary mb-3";
    el.hidden = false;
    el.textContent = "This appraisal was cancelled.";
  } else {
    el.hidden = true;
  }
}

function load(session, id) {
  apiClient.getAppraisal(id).then((a) => {
    document.getElementById("appraisal-cycle-name").textContent = a.cycleName;
    document.getElementById("appraisal-status").innerHTML = renderBadge(a.status, APPRAISAL_STATUS_BADGE_MAP);
    document.getElementById("appraisal-employee-snapshot").textContent = a.snapshot
      ? [a.snapshot.name, a.snapshot.designation, a.snapshot.department].filter(Boolean).join(" — ")
      : "";

    const isEmployee = a.employeeId === session.id;
    const isManager = a.managerId === session.id;
    // Form vs. summary is driven by a.status (the state machine - see
    // js/appraisal-status.js), not by whether a field happens to be set:
    // RETURNED re-opens the manager form even though managerRatingValueId
    // is still populated from the prior submission.
    const selfFormOpen = a.status === "SELF_APPRAISAL";
    const managerFormOpen = a.status === "MANAGER_REVIEW" || a.status === "RETURNED";
    const hasSelfData = a.selfRatingValueId != null;
    const hasManagerData = a.managerRatingValueId != null;

    const ratingOptions = a.ratingValues.map((r) => '<option value="' + r.id + '">' + esc(r.label) + "</option>").join("");
    document.getElementById("self-rating").innerHTML = ratingOptions;
    document.getElementById("manager-rating").innerHTML = ratingOptions;

    // A fresh (not-yet-submitted) editor seeds from the cycle's shared
    // category template (set by HR in hr-appraisal-cycles.html) rather than
    // starting blank; defaultCategories() is only a last-resort fallback for
    // a cycle with no template configured at all.
    function seedFrom(existing) {
      return existing && existing.length ? existing : a.cycleCategories && a.cycleCategories.length ? cloneCategoryTree(a.cycleCategories) : defaultCategories();
    }

    renderLifecycleBanner(a, isEmployee);

    const selfForm = document.getElementById("self-review-form");
    const selfSummary = document.getElementById("self-review-summary");
    if (selfFormOpen && isEmployee) {
      selfForm.hidden = false;
      document.getElementById("self-comments").value = a.selfComments || "";
      selfEditor.set(seedFrom(a.selfCategories));
    } else {
      selfForm.hidden = true;
    }
    if (!selfFormOpen && hasSelfData) {
      selfSummary.hidden = false;
      selfSummary.innerHTML =
        renderReviewSummary("Self-review", a.ratingValues, a.selfRatingValueId, a.selfComments) +
        renderCategoriesSummary(a.selfCategories || []) +
        renderSelfScoreSummary(a) +
        (isEmployee && a.status === "FINALIZED" ? '<button type="button" id="acknowledge-btn" class="btn btn-sm btn-outline-primary mt-3">Acknowledge final rating</button>' : "");
    } else {
      selfSummary.hidden = true;
    }

    const managerForm = document.getElementById("manager-review-form");
    const managerSummary = document.getElementById("manager-review-summary");
    if (managerFormOpen && isManager) {
      managerForm.hidden = false;
      managerEditor.set(seedFrom(a.managerCategories));
    } else {
      managerForm.hidden = true;
    }
    if (!managerFormOpen && hasManagerData) {
      managerSummary.hidden = false;
      managerSummary.innerHTML =
        renderReviewSummary("Manager review", a.ratingValues, a.managerRatingValueId, a.managerComments) +
        renderCategoriesSummary(a.managerCategories || []) +
        renderFinalScoreSummary(a);
    } else {
      managerSummary.hidden = true;
    }

    const ackBtn = document.getElementById("acknowledge-btn");
    if (ackBtn) {
      ackBtn.addEventListener("click", function () {
        apiClient.acknowledgeAppraisal(id).then(() => window.location.reload()).catch(showError);
      });
    }

    renderGoals(a.goals || []);

    selfForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      apiClient
        .submitSelfReview(id, {
          selfRatingValueId: Number(document.getElementById("self-rating").value),
          selfComments: normalizeText(document.getElementById("self-comments").value),
          selfCategories: selfEditor.get(),
        })
        .then(() => window.location.reload())
        .catch(showError);
    });

    managerForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      apiClient
        .submitManagerReview(id, {
          managerRatingValueId: Number(document.getElementById("manager-rating").value),
          managerComments: normalizeText(document.getElementById("manager-comments").value),
          managerCategories: managerEditor.get(),
        })
        .then(() => window.location.reload())
        .catch(showError);
    });

    document.getElementById("add-goal-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      const input = document.getElementById("new-goal");
      const description = normalizeText(input.value);
      if (!description) return;
      apiClient
        .createAppraisalGoal({ cycleId: a.cycleId, employeeId: a.employeeId, description: description, status: "NOT_STARTED" })
        .then(() => {
          input.value = "";
          window.location.reload();
        })
        .catch(showError);
    });
  });
}

function renderReviewSummary(title, ratingValues, ratingValueId, comments) {
  const ratingLabel = (ratingValues.find((r) => r.id === ratingValueId) || {}).label || "—";
  return (
    '<h2 class="h6">' + esc(title) + "</h2>" +
    '<p class="mb-1"><strong>Rating:</strong> ' + esc(ratingLabel) + "</p>" +
    '<p class="mb-0">' + esc(comments || "—") + "</p>"
  );
}

function renderGoals(goals) {
  const list = document.getElementById("goals-list");
  list.innerHTML = goals.length
    ? goals
        .map(
          (g) =>
            '<li class="list-group-item d-flex align-items-center justify-content-between gap-2">' +
            "<span>" + esc(g.description) + "</span>" +
            '<select class="form-select form-select-sm w-auto" data-goal-id="' + g.id + '">' +
            Object.keys(APPRAISAL_GOAL_STATUS_BADGE_MAP)
              .map((s) => '<option value="' + s + '"' + (s === g.status ? " selected" : "") + ">" + esc(APPRAISAL_GOAL_STATUS_BADGE_MAP[s].label) + "</option>")
              .join("") +
            "</select>" +
            "</li>"
        )
        .join("")
    : '<li class="list-group-item text-body-secondary">No goals yet.</li>';

  list.querySelectorAll("select[data-goal-id]").forEach((select) => {
    select.addEventListener("change", function () {
      apiClient.updateAppraisalGoal(this.getAttribute("data-goal-id"), { status: this.value }).catch(showError);
    });
  });
}

function showError(err) {
  const errorEl = document.getElementById("appraisal-error");
  errorEl.textContent = err.message || "Could not save the change.";
  errorEl.hidden = false;
}
