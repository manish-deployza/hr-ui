/* Self-review is employee-only until submitted; the manager section only
 * appears once the self-review is submitted, per Reasoning/17-module-
 * appraisal.md's SELF_PENDING -> MANAGER_PENDING -> FINALIZED chain. */

document.addEventListener("session-ready", function (e) {
  const id = qs("id");
  load(e.detail, id);
});

let categories = [];
let nextCategoryId = 1;

function makeCategory(name) {
  return newCategory("cat-" + nextCategoryId++, name);
}

// Delegated on the container (rather than per-node) since the whole subtree
// gets re-rendered on add/remove — listeners bound to individual nodes would
// be thrown away with them.
document.getElementById("eval-categories").addEventListener("input", function (ev) {
  const nameId = ev.target.getAttribute("data-cat-name");
  if (nameId) {
    findCategoryNode(nameId, categories).name = ev.target.value;
    return;
  }
  const commentId = ev.target.getAttribute("data-cat-comment");
  if (commentId) findCategoryNode(commentId, categories).comment = ev.target.value;
});

document.getElementById("eval-categories").addEventListener("change", function (ev) {
  const scoreId = ev.target.getAttribute("data-cat-score");
  if (scoreId) findCategoryNode(scoreId, categories).score = Number(ev.target.value);
});

document.getElementById("eval-categories").addEventListener("click", function (ev) {
  const removeBtn = ev.target.closest("[data-cat-remove]");
  if (removeBtn) {
    removeCategoryNode(removeBtn.getAttribute("data-cat-remove"), categories);
    renderCategories();
    return;
  }
  const addSubBtn = ev.target.closest("[data-cat-addsub]");
  if (addSubBtn) {
    findCategoryNode(addSubBtn.getAttribute("data-cat-addsub"), categories).subsections.push(makeCategory(""));
    renderCategories();
  }
});

function renderCategoryNode(node, depth) {
  const scoreButtons = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        '<input type="radio" class="btn-check" name="score-' + node.id + '" id="score-' + node.id + "-" + n + '" value="' + n + '" data-cat-score="' + node.id + '"' + (node.score === n ? " checked" : "") + ">" +
        '<label class="btn btn-outline-primary score-circle" for="score-' + node.id + "-" + n + '">' + n + "</label>"
    )
    .join("");

  return (
    '<div class="card p-2 mb-2" style="margin-left: ' + depth * 24 + 'px;">' +
    '<div class="d-flex align-items-center gap-2 mb-2">' +
    '<input type="text" class="form-control form-control-sm" data-cat-name="' + node.id + '" value="' + esc(node.name) + '" placeholder="Category name">' +
    '<button type="button" class="btn btn-sm btn-outline-secondary text-nowrap" data-cat-addsub="' + node.id + '"><i class="bi bi-plus"></i> Sub-section</button>' +
    '<button type="button" class="btn btn-sm btn-outline-danger" data-cat-remove="' + node.id + '"><i class="bi bi-trash"></i></button>' +
    "</div>" +
    '<div class="score-dots mb-2" role="group" aria-label="Score">' + scoreButtons + "</div>" +
    '<textarea class="form-control form-control-sm" rows="2" placeholder="Comment" data-cat-comment="' + node.id + '">' + esc(node.comment) + "</textarea>" +
    (node.subsections.length ? '<div class="mt-2">' + node.subsections.map((s) => renderCategoryNode(s, depth + 1)).join("") + "</div>" : "") +
    "</div>"
  );
}

function renderCategories() {
  document.getElementById("eval-categories").innerHTML = categories.length
    ? categories.map((c) => renderCategoryNode(c, 0)).join("")
    : '<p class="text-body-secondary small">No categories yet — add one to start scoring specific areas.</p>';
}

function renderCategoriesSummary(list) {
  if (!list.length) return "";
  return '<h3 class="h6 mt-3">Evaluation categories</h3><ul class="list-group">' + list.map(renderCategorySummaryNode).join("") + "</ul>";
}

function renderScoreDots(score) {
  return (
    '<div class="score-dots">' +
    [1, 2, 3, 4, 5].map((n) => '<span class="score-circle' + (score === n ? " filled" : "") + '">' + n + "</span>").join("") +
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

function load(session, id) {
  apiClient.getAppraisal(id).then((a) => {
    document.getElementById("appraisal-cycle-name").textContent = a.cycleName;
    document.getElementById("appraisal-status").innerHTML = renderBadge(a.status, APPRAISAL_STATUS_BADGE_MAP);

    const isEmployee = a.employeeId === session.id;
    const isManager = a.managerId === session.id;
    const selfSubmitted = a.selfRatingValueId != null;
    const managerSubmitted = a.managerRatingValueId != null;

    const ratingOptions = a.ratingValues.map((r) => '<option value="' + r.id + '">' + esc(r.label) + "</option>").join("");
    document.getElementById("self-rating").innerHTML = ratingOptions;
    document.getElementById("manager-rating").innerHTML = ratingOptions;

    const selfForm = document.getElementById("self-review-form");
    const selfSummary = document.getElementById("self-review-summary");
    if (selfSubmitted) {
      selfForm.hidden = true;
      selfSummary.hidden = false;
      selfSummary.innerHTML = renderReviewSummary("Self-review", a.ratingValues, a.selfRatingValueId, a.selfComments);
    } else if (isEmployee) {
      selfForm.hidden = false;
      document.getElementById("self-comments").value = a.selfComments || "";
    } else {
      selfForm.hidden = true;
    }

    const managerForm = document.getElementById("manager-review-form");
    const managerSummary = document.getElementById("manager-review-summary");
    if (managerSubmitted) {
      managerForm.hidden = true;
      managerSummary.hidden = false;
      managerSummary.innerHTML =
        renderReviewSummary("Manager review", a.ratingValues, a.managerRatingValueId, a.managerComments) +
        renderCategoriesSummary(a.managerCategories || []);
    } else if (selfSubmitted && isManager) {
      managerForm.hidden = false;
      categories = a.managerCategories && a.managerCategories.length ? a.managerCategories : defaultCategories();
      // Starts well above the ids defaultCategories() uses (cat-1..cat-3,
      // cat-1-1, cat-1-2) so a freshly-added category can't collide with one
      // already in the tree.
      nextCategoryId = 100;
      renderCategories();
    } else {
      managerForm.hidden = true;
    }

    renderGoals(a.goals || []);

    selfForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      apiClient
        .submitSelfReview(id, {
          selfRatingValueId: Number(document.getElementById("self-rating").value),
          selfComments: normalizeText(document.getElementById("self-comments").value),
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
          managerCategories: categories,
        })
        .then(() => window.location.reload())
        .catch(showError);
    });

    document.getElementById("add-category-btn").addEventListener("click", function () {
      categories.push(makeCategory(""));
      renderCategories();
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
