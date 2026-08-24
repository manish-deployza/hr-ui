document.addEventListener("session-ready", function () {
  apiClient
    .hrLopWatchlist()
    .then((flags) => {
      document.getElementById("hr-lop-watchlist-body").innerHTML = flags.length
        ? flags
            .map(
              (f) =>
                "<tr>" +
                "<td>" + esc(f.employeeName) + "</td>" +
                "<td>" + formatDate(f.lopStartDate) + " – " + formatDate(f.lopEndDate) + "</td>" +
                "<td>" + formatDate(f.flaggedAt) + "</td>" +
                "</tr>"
            )
            .join("")
        : '<tr><td colspan="3" class="text-center text-body-secondary py-4">Nobody flagged right now.</td></tr>';
    })
    .catch((err) => {
      const errorEl = document.getElementById("hr-lop-watchlist-error");
      errorEl.textContent = err.message || "Could not load the watchlist.";
      errorEl.hidden = false;
    });
});
