document.addEventListener("session-ready", function () {
  apiClient
    .myAppraisals()
    .then((appraisals) => {
      document.getElementById("appraisals-body").innerHTML = appraisals.length
        ? appraisals
            .map(
              (a) =>
                "<tr>" +
                "<td>" + esc(a.cycleName) + "</td>" +
                "<td>" + renderBadge(a.status, APPRAISAL_STATUS_BADGE_MAP) + "</td>" +
                "<td>" + esc(a.selfRatingLabel || "—") + "</td>" +
                "<td>" + esc(a.managerRatingLabel || "—") + "</td>" +
                '<td><a href="appraisal-view.html?id=' + encodeURIComponent(a.id) + '">Open</a></td>' +
                "</tr>"
            )
            .join("")
        : '<tr><td colspan="5" class="text-center text-body-secondary py-4">No appraisal cycles yet.</td></tr>';
    })
    .catch((err) => {
      const errorEl = document.getElementById("appraisals-error");
      errorEl.textContent = err.message || "Could not load appraisals.";
      errorEl.hidden = false;
    });
});
