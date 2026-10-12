// ponytail: naive split, no quoted-field/escaped-delimiter support — swap
// for a real CSV parser if uploaded files start containing commas in names.
function parseDelimited(text) {
  // Strip a UTF-8 BOM — Excel/Sheets prepend one to CSV exports, which would
  // otherwise glue itself to the first header ("﻿name") and break lookups.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  if (!lines.length) return [];
  const delimiter = lines[0].indexOf("\t") !== -1 ? "\t" : ",";
  // Case preserved, not lowercased — rows now pass straight through to the
  // backend on some imports (e.g. employee import's managerEmail,
  // employeeCode, dateOfJoining), so the header casing IS the JSON field
  // name and must survive intact.
  const headers = lines[0].split(delimiter).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter);
    const row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] || "").trim(); });
    return row;
  });
}

if (typeof module !== "undefined") module.exports = { parseDelimited };
