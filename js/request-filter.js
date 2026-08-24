// Dates are compared as "YYYY-MM-DD" strings, which sort the same as the
// dates they represent, so no Date parsing is needed.
function requestMatchesFilters(request, filters) {
  if (filters.employee && (request.employeeName || "").toLowerCase().indexOf(filters.employee.toLowerCase()) === -1) return false;
  if (filters.leaveType && request.leaveTypeName !== filters.leaveType) return false;
  if (filters.status && request.status !== filters.status) return false;
  if (filters.dateFrom && request.endDate < filters.dateFrom) return false;
  if (filters.dateTo && request.startDate > filters.dateTo) return false;
  return true;
}

if (typeof module !== "undefined") module.exports = { requestMatchesFilters };
