let requestModal = null;
let applyModal = null;

function getRequestModal() {
  if (!requestModal) requestModal = new bootstrap.Modal(document.getElementById("request-modal"));
  return requestModal;
}

function getApplyModal() {
  if (!applyModal) applyModal = new bootstrap.Modal(document.getElementById("apply-modal"));
  return applyModal;
}

document.addEventListener("session-ready", function () {
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
          setTimeout(() => {
            getApplyModal().hide();
            location.reload();
          }, 800);
        })
        .catch((err) => {
          errorEl.textContent = err.message || "Could not submit request.";
          errorEl.hidden = false;
        });
    });
  });

  apiClient
    .myRequests()
    .then((requests) => {
      document.getElementById("history-body").innerHTML = requests
        .map(
          (r) =>
            "<tr>" +
            "<td>" + esc(r.leaveTypeName) + "</td>" +
            "<td>" + formatDate(r.startDate) + " – " + formatDate(r.endDate) + "</td>" +
            "<td>" + formatDateTime(r.appliedAt) + "</td>" +
            "<td>" + renderStatusBadge(r.status) + "</td>" +
            '<td><a href="#" data-request-id="' + encodeURIComponent(r.id) + '">View</a></td>' +
            "</tr>"
        )
        .join("");
    })
    .catch(reportApiError);
});

document.getElementById("history-body").addEventListener("click", function (ev) {
  const link = ev.target.closest("[data-request-id]");
  if (!link) return;
  ev.preventDefault();
  openRequestModal(link.getAttribute("data-request-id"));
});

function openRequestModal(id) {
  document.getElementById("modal-action-error").hidden = true;
  apiClient
    .getLeaveRequest(id)
    .then((request) => {
      document.getElementById("modal-detail-type").textContent = request.leaveTypeName;
      document.getElementById("modal-detail-dates").textContent = formatDate(request.startDate) + " – " + formatDate(request.endDate);
      document.getElementById("modal-detail-requested").textContent = formatDateTime(request.appliedAt) || "—";
      document.getElementById("modal-detail-status").innerHTML = renderStatusBadge(request.status);
      document.getElementById("modal-detail-reason").textContent = request.reason || "—";

      renderApprovalTimeline(document.getElementById("modal-approval-timeline"), request.approvals || []);

      const canCancel = ["APPLIED", "PENDING_MANAGER", "PENDING_HR"].indexOf(request.status) !== -1;
      const cancelBtn = document.getElementById("modal-cancel-btn");
      cancelBtn.hidden = !canCancel;
      cancelBtn.onclick = () => {
        confirmDanger(
          "Cancel your " + request.leaveTypeName + " request for " + formatDate(request.startDate) + " – " + formatDate(request.endDate) + "? This cannot be undone.",
          "Cancel request"
        ).then(function (confirmed) {
          if (!confirmed) return;
          apiClient
            .cancelLeaveRequest(id)
            .then(() => {
              getRequestModal().hide();
              location.reload();
            })
            .catch(reportApiError);
        });
      };

      getRequestModal().show();
    })
    .catch(reportApiError);
}
