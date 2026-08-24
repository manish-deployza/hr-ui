// Builds a CSV string from header/row arrays and triggers a browser download.
// ponytail: naive quoting (wrap + double-up embedded quotes), no BOM/locale
// handling — swap for a real CSV lib if exports start feeding back into Excel
// with non-ASCII data.
function downloadCsv(filename, headers, rows) {
  const escapeCell = (value) => '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  const lines = [headers.map(escapeCell).join(",")].concat(rows.map((row) => row.map(escapeCell).join(",")));
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

if (typeof module !== "undefined") module.exports = { downloadCsv };
