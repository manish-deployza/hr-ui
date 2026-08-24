/* Generic client-side search: any <input data-filter-target="CSS selector">
 * hides every matched element whose text doesn't contain the typed query.
 * One script, wired declaratively per page via the data attribute, instead
 * of repeating filter logic in every page's own script. */
function matchesFilter(text, query) {
  return query === "" || text.toLowerCase().indexOf(query.toLowerCase()) !== -1;
}

if (typeof document !== "undefined") {
  document.querySelectorAll("[data-filter-target]").forEach(function (input) {
    const selector = input.getAttribute("data-filter-target");
    input.addEventListener("input", function () {
      const query = input.value.trim();
      document.querySelectorAll(selector).forEach(function (item) {
        item.hidden = !matchesFilter(item.textContent, query);
      });
    });
  });
}

if (typeof module !== "undefined") module.exports = { matchesFilter };
