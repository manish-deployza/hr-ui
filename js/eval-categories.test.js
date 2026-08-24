const assert = require("assert");
const { newCategory, findCategoryNode, removeCategoryNode, defaultCategories } = require("./eval-categories.js");

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

console.log("eval-categories: ok");
