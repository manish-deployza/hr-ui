document.addEventListener("session-ready", function () {
  apiClient
    .hrHolidays()
    .then((holidays) => {
      renderGroup("national-holidays-body", holidays.filter((h) => h.nonNegotiable));
      renderGroup("other-holidays-body", holidays.filter((h) => !h.nonNegotiable));
    })
    .catch((err) => {
      const errorEl = document.getElementById("hr-holidays-error");
      errorEl.textContent = err.message || "Could not load holidays.";
      errorEl.hidden = false;
    });
});

function renderGroup(bodyId, holidays) {
  document.getElementById(bodyId).innerHTML = holidays.length
    ? holidays
        .map(
          (h) =>
            "<tr>" +
            "<td>" + esc(h.name) + "</td>" +
            "<td>" + formatDate(h.date) + "</td>" +
            "<td>" + esc(new Date(h.date).toLocaleDateString(undefined, { weekday: "long" })) + "</td>" +
            "</tr>"
        )
        .join("")
    : '<tr><td colspan="3" class="text-center text-body-secondary py-4">None.</td></tr>';
}
