document.addEventListener("session-ready", function () {
  const id = qs("id");

  Promise.all([apiClient.getHrEmployee(id), apiClient.hrEmployees()])
    .then(([employee, employees]) => {
      if (!employee) {
        showDetailError("Employee not found.");
        return;
      }
      render(employee, employees);
    })
    .catch((err) => {
      showDetailError(err.message || "Could not load employee.");
    });
});

function showDetailError(message) {
  const errorEl = document.getElementById("detail-error");
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function render(employee, employees) {
  document.title = employee.name + " — Employee Hub";
  document.getElementById("detail-name").textContent = employee.name;
  document.getElementById("detail-code").textContent = employee.employeeCode || "—";
  document.getElementById("detail-email").innerHTML = esc(employee.email) + (employee.emailVerified
    ? ' <span class="badge text-bg-success"><i class="bi bi-patch-check-fill"></i> Verified</span>'
    : ' <span class="badge text-bg-secondary">Not verified</span>');
  document.getElementById("detail-phone").textContent = employee.phone || "—";

  const isManager = managersOf(employees).some((m) => m.id === employee.id);
  document.getElementById("detail-role").innerHTML = esc(employee.role) + (isManager ? ' <span class="badge text-bg-secondary">Manager</span>' : "");

  document.getElementById("detail-status").textContent = employee.status || "—";
  document.getElementById("detail-type").textContent = employee.employeeType || "—";
  document.getElementById("detail-designation").textContent = employee.designation || "—";
  document.getElementById("detail-department").textContent = employee.department || "—";
  document.getElementById("detail-doj").textContent = employee.dateOfJoining ? formatDate(employee.dateOfJoining) : "—";
  document.getElementById("detail-doe").textContent = employee.dateOfExit ? formatDate(employee.dateOfExit) : "—";
  document.getElementById("detail-salary").textContent = employee.basicSalary != null ? employee.basicSalary.toLocaleString() : "—";

  const manager = employees.find((e) => e.id === employee.managerId);
  document.getElementById("detail-manager").innerHTML = manager
    ? '<a href="employee-view.html?id=' + encodeURIComponent(manager.id) + '">' + esc(manager.name) + "</a>"
    : "No manager (top of hierarchy)";

  const reports = directReportsOf(employees, employee.id);
  document.getElementById("detail-reports-body").innerHTML = reports.length
    ? reports
        .map(
          (r) =>
            "<tr>" +
            '<td><a href="employee-view.html?id=' + encodeURIComponent(r.id) + '">' + esc(r.name) + "</a></td>" +
            "<td>" + esc(r.email) + "</td>" +
            "<td>" + esc(r.role) + "</td>" +
            "</tr>"
        )
        .join("")
    : '<tr><td colspan="3" class="text-center text-body-secondary py-4">No direct reports.</td></tr>';
}
