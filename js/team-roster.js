// "Manager" is derived from who reports to whom (employee.managerId), not a
// stored role — matches 06-auth-and-security.md's "is_manager would drift"
// reasoning. Anyone currently pointed at by another employee's managerId
// counts, even outside the HR_ADMIN/EMPLOYEE role split.
function managersOf(employees) {
  const managerIds = new Set(employees.map((e) => e.managerId).filter((id) => id != null));
  return employees.filter((e) => managerIds.has(e.id));
}

function directReportsOf(employees, managerId) {
  return employees.filter((e) => e.managerId === managerId);
}

// filters.managerId: undefined/null = no filter, "NONE" = top of hierarchy
// (employee.managerId is null), otherwise a specific manager's id.
function employeeMatchesFilters(employee, filters) {
  if (filters.managerId === "NONE") {
    if (employee.managerId != null) return false;
  } else if (filters.managerId != null) {
    if (employee.managerId !== filters.managerId) return false;
  }
  if (filters.search) {
    const haystack = (employee.name + " " + employee.email + " " + employee.role).toLowerCase();
    if (haystack.indexOf(filters.search.toLowerCase()) === -1) return false;
  }
  return true;
}

if (typeof module !== "undefined") module.exports = { managersOf, directReportsOf, employeeMatchesFilters };
