// A manager-customizable evaluation rubric: an arbitrarily nested tree of
// named categories (e.g. Coding -> Code quality, Testing), each scored 1-5
// with its own comment. Kept as pure tree operations, separate from the DOM
// rendering in js/page/appraisal-view.js, so they're testable without a DOM.
function newCategory(id, name) {
  return { id: id, name: name || "", score: null, comment: "", subsections: [] };
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

if (typeof module !== "undefined") module.exports = { newCategory, findCategoryNode, removeCategoryNode, defaultCategories };
