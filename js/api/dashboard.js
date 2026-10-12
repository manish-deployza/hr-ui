document.addEventListener("session-ready", function (e) {
  // Only nag on an explicit false — a backend that doesn't send the flag yet
  // shouldn't spam every user.
  if (e.detail && e.detail.emailVerified === false) {
    document.getElementById("email-unverified-alert").hidden = false;
  }

  apiClient
    .myBalances()
    .then((balances) => {
      renderLeaveBalanceCards(document.getElementById("balance-cards"), balances);
    })
    .catch((err) => {
      const errorEl = document.getElementById("balance-cards-error");
      errorEl.textContent = err.message || "Could not load leave balances.";
      errorEl.hidden = false;
    });

  apiClient
    .myRecentRequests()
    .then((requests) => {
      document.getElementById("recent-requests-body").innerHTML = requests.length
        ? requests
            .map(
              (r) =>
                "<tr>" +
                "<td>" + esc(r.leaveTypeName || "—") + "</td>" +
                "<td>" + formatDate(r.startDate) + " – " + formatDate(r.endDate) + "</td>" +
                "<td>" + renderStatusBadge(r.status) + "</td>" +
                "</tr>"
            )
            .join("")
        : '<tr><td colspan="3" class="text-center text-body-secondary py-4">No leave requests yet.</td></tr>';
    })
    .catch((err) => {
      const errorEl = document.getElementById("recent-requests-error");
      errorEl.textContent = err.message || "Could not load recent requests.";
      errorEl.hidden = false;
    });
});
