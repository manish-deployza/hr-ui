document.addEventListener("session-ready", function () {
  apiClient.myRequests().then((requests) => {
    document.getElementById("history-body").innerHTML = requests
      .map(
        (r) =>
          "<tr>" +
          "<td>" + esc(r.leaveTypeName) + "</td>" +
          "<td>" + formatDate(r.startDate) + " – " + formatDate(r.endDate) + "</td>" +
          "<td>" + renderStatusBadge(r.status) + "</td>" +
          '<td><a href="leave-view.html?id=' + encodeURIComponent(r.id) + '">View</a></td>' +
          "</tr>"
      )
      .join("");
  });
});
