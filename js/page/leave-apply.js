document.addEventListener("session-ready", function () {
  // Balances are needed here too — the LOP option is only enabled once CL
  // and PL are both exhausted (see js/leave-request-form.js).
  Promise.all([apiClient.leaveTypes(), apiClient.myBalances()]).then(([leaveTypes, balances]) => {
    initLeaveRequestForm(document.getElementById("leave-request-form"), leaveTypes, balances, function (payload) {
      const successEl = document.getElementById("apply-success");
      const errorEl = document.getElementById("apply-error");
      successEl.hidden = true;
      errorEl.hidden = true;

      apiClient
        .applyForLeave(payload)
        .then(() => {
          successEl.textContent = "Request submitted.";
          successEl.hidden = false;
          setTimeout(() => (window.location.href = "leave-history.html"), 800);
        })
        .catch((err) => {
          errorEl.textContent = err.message || "Could not submit request.";
          errorEl.hidden = false;
        });
    });
  });
});
