const assert = require("assert");
const {
  newCategory,
  findCategoryNode,
  removeCategoryNode,
  defaultCategories,
  standardCategories,
  cloneCategoryTree,
  averageScore,
  weightedCategoryScore,
  performanceLevelFor,
} = require("./eval-categories.js");

const tree = [
  Object.assign(newCategory("a", "A"), { subsections: [newCategory("a1", "A1"), newCategory("a2", "A2")] }),
  newCategory("b", "B"),
];

assert.strictEqual(findCategoryNode("a", tree).name, "A", "finds a top-level node");
assert.strictEqual(findCategoryNode("a1", tree).name, "A1", "finds a nested node");
assert.strictEqual(findCategoryNode("missing", tree), null, "returns null for an unknown id");

assert.strictEqual(removeCategoryNode("a1", tree), true, "removes a nested node");
assert.strictEqual(findCategoryNode("a1", tree), null, "removed node is no longer findable");
assert.strictEqual(findCategoryNode("a2", tree).name, "A2", "sibling of the removed node survives");
assert.strictEqual(removeCategoryNode("missing", tree), false, "removing an unknown id reports false");

const defaults = defaultCategories();
assert.strictEqual(defaults.length, 3, "three starter categories");
assert.strictEqual(defaults[0].name, "Coding");
assert.strictEqual(defaults[0].subsections.length, 2, "Coding starts with two sub-sections");
assert.strictEqual(defaults[0].subsections[0].score, null, "starter categories are unscored");

const standard = standardCategories();
assert.strictEqual(standard.length, 5, "five standard sections");
assert.strictEqual(standard.reduce((sum, c) => sum + c.weight, 0), 90, "standard weights total 90% (remaining 10% is Manager Overall Assessment)");
assert.strictEqual(standard[1].subsections.length, 4, "Competencies has four sub-items");

assert.strictEqual(averageScore(newCategory("x", "X")), null, "unscored node averages to null");
const scoredLeaf = Object.assign(newCategory("y", "Y"), { score: 4 });
assert.strictEqual(averageScore(scoredLeaf), 4, "a directly-scored leaf uses its own score");
const scoredParent = Object.assign(newCategory("z", "Z"), {
  subsections: [Object.assign(newCategory("z1", "Z1"), { score: 3 }), Object.assign(newCategory("z2", "Z2"), { score: 5 })],
});
assert.strictEqual(averageScore(scoredParent), 4, "a container averages its scored descendants");

const cloned = cloneCategoryTree([Object.assign(newCategory("g", "Goals", 45), { score: 4, subsections: [newCategory("g1", "G1", 0)] })]);
assert.strictEqual(cloned[0].weight, 45, "cloneCategoryTree round-trips a top-level weight");
assert.strictEqual(weightedCategoryScore(cloned), 4 * 0.45, "a cloned weighted tree still computes its weighted score");

assert.strictEqual(weightedCategoryScore([]), null, "no sections -> no weighted score");
const unweighted = [Object.assign(newCategory("a", "A"), { score: 5 })];
assert.strictEqual(weightedCategoryScore(unweighted), null, "weight-0 sections don't contribute -> null (legacy unweighted rubric)");
const weighted = [
  Object.assign(newCategory("goals", "Goals", 45), { score: 4 }),
  Object.assign(newCategory("comp", "Competencies", 20), { score: 5 }),
];
assert.strictEqual(weightedCategoryScore(weighted), 4 * 0.45 + 5 * 0.2, "weighted average of the scored, weighted sections");

const levels = [
  { minScore: 4.5, maxScore: 5, label: "Exceptional" },
  { minScore: 3, maxScore: 4.49, label: "Meets Expectations" },
];
assert.strictEqual(performanceLevelFor(4.8, levels).label, "Exceptional");
assert.strictEqual(performanceLevelFor(3.5, levels).label, "Meets Expectations");
assert.strictEqual(performanceLevelFor(null, levels), null, "no score -> no level");
assert.strictEqual(performanceLevelFor(1, levels), null, "score outside every band -> no level");

console.log("eval-categories: ok");
