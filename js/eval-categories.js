// A manager-customizable evaluation rubric: an arbitrarily nested tree of
// named categories (e.g. Coding -> Code quality, Testing), each scored 1-5
// with its own comment. Kept as pure tree operations, separate from the DOM
// rendering in js/api/appraisal-view.js, so they're testable without a DOM.
//
// Top-level nodes carry an optional `weight` (percent) - see
// 18-appraisal-enterprise-expansion.md's weighted schema (Goals & KPIs 45%,
// Competencies 20%, Behaviour 15%, Learning 5%, Innovation 5%, the
// remaining 10% being "Manager Overall Assessment", computed separately in
// js/api/appraisal-view.js from the existing single overall-rating field
// rather than as a category, to avoid double-counting the manager). A cycle
// with no weights configured (weight 0/null everywhere) is unweighted -
// legacy behavior, weightedCategoryScore() then returns null.
function newCategory(id, name, weight) {
  return { id: id, name: name || "", weight: weight || 0, score: null, comment: "", subsections: [] };
}

// The standard weighted schema from 18-appraisal-enterprise-expansion.md,
// for the "Load standard schema" button in hr-appraisal-cycles.html.
function standardCategories() {
  return [
    Object.assign(newCategory("goals", "Goals & KPIs", 45), { subsections: [] }),
    Object.assign(newCategory("competencies", "Competencies", 20), {
      subsections: [
        newCategory("competencies-technical", "Technical Knowledge"),
        newCategory("competencies-problem-solving", "Problem Solving"),
        newCategory("competencies-communication", "Communication"),
        newCategory("competencies-collaboration", "Collaboration"),
      ],
    }),
    Object.assign(newCategory("behaviour", "Behaviour & Culture", 15), {
      subsections: [
        newCategory("behaviour-ownership", "Ownership"),
        newCategory("behaviour-teamwork", "Teamwork"),
        newCategory("behaviour-accountability", "Accountability"),
        newCategory("behaviour-leadership", "Leadership"),
      ],
    }),
    Object.assign(newCategory("learning", "Learning & Development", 5), { subsections: [] }),
    Object.assign(newCategory("innovation", "Innovation", 5), { subsections: [] }),
  ];
}

// Average of every non-null score found on this node and its descendants -
// lets a section be scored either directly (a leaf, or a container scored
// as a whole) or via its sub-items (averaged in), without the caller
// needing to know which.
function averageScore(node) {
  const scores = [];
  (function collect(n) {
    if (n.score != null) scores.push(n.score);
    (n.subsections || []).forEach(collect);
  })(node);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

// Sum of each weighted top-level section's average score * its weight.
// Only sections that actually carry a weight contribute - null if none do
// (unweighted/legacy tree) or none of the weighted sections are scored yet.
function weightedCategoryScore(categories) {
  let weightedSum = 0;
  let weightUsed = 0;
  (categories || []).forEach((node) => {
    if (!node.weight) return;
    const avg = averageScore(node);
    if (avg == null) return;
    weightedSum += avg * (node.weight / 100);
    weightUsed += node.weight;
  });
  return weightUsed ? weightedSum : null;
}

// HR-configured score -> performance-level lookup (data/appraisal-
// performance-levels.json), e.g. 4.5-5.0 -> "Exceptional".
function performanceLevelFor(score, levels) {
  if (score == null) return null;
  return (levels || []).find((l) => score >= l.minScore && score <= l.maxScore) || null;
}

function findCategoryNode(id, list) {
  for (const node of list) {
    if (node.id === id) return node;
    const found = findCategoryNode(id, node.subsections);
    if (found) return found;
  }
  return null;
}

// Mutates list (and its descendants) in place; returns true if a node was removed.
function removeCategoryNode(id, list) {
  const idx = list.findIndex((n) => n.id === id);
  if (idx !== -1) {
    list.splice(idx, 1);
    return true;
  }
  return list.some((n) => removeCategoryNode(id, n.subsections));
}

function defaultCategories() {
  return [
    Object.assign(newCategory("cat-1", "Coding"), {
      subsections: [newCategory("cat-1-1", "Code quality"), newCategory("cat-1-2", "Testing")],
    }),
    newCategory("cat-2", "Core values"),
    newCategory("cat-3", "Availability"),
  ];
}

// Deep clone — used both to seed a manager's scorable copy from a cycle's
// shared category template (js/page/appraisal-view.js) and to snapshot a
// template before editing it (js/page/hr-appraisal-cycles.js), so neither
// mutates the source tree in place.
function cloneCategoryTree(nodes) {
  return (nodes || []).map((n) => ({ id: n.id, name: n.name, weight: n.weight, score: n.score, comment: n.comment, subsections: cloneCategoryTree(n.subsections) }));
}

if (typeof module !== "undefined")
  module.exports = {
    newCategory,
    findCategoryNode,
    removeCategoryNode,
    defaultCategories,
    standardCategories,
    cloneCategoryTree,
    averageScore,
    weightedCategoryScore,
    performanceLevelFor,
  };
