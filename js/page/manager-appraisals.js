document.addEventListener("session-ready", function () {
  apiClient
    .teamAppraisals()
    .then((appraisals) => {
      document.getElementById("team-appraisals-body").innerHTML = appraisals.length
        ? appraisals
            .map(
              (a) =>
                "<tr>" +
                "<td>" + esc(a.employeeName) + "</td>" +
                "<td>" + esc(a.cycleName) + "</td>" +
                "<td>" + renderBadge(a.status, APPRAISAL_STATUS_BADGE_MAP) + "</td>" +
                '<td><a href="appraisal-view.html?id=' + encodeURIComponent(a.id) + '">Review</a></td>' +
                "</tr>"
            )
            .join("")
        : '<tr><td colspan="4" class="text-center text-body-secondary py-4">No reviews for the open cycle.</td></tr>';
    })
    .catch((err) => {
      const errorEl = document.getElementById("team-appraisals-error");
      errorEl.textContent = err.message || "Could not load team appraisals.";
      errorEl.hidden = false;
    });
});
