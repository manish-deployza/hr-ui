// ponytail: naive split, no quoted-field/escaped-delimiter support — swap
// for a real CSV parser if uploaded files start containing commas in names.
function parseDelimited(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  if (!lines.length) return [];
  const delimiter = lines[0].indexOf("\t") !== -1 ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter);
    const row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] || "").trim(); });
    return row;
  });
}

if (typeof module !== "undefined") module.exports = { parseDelimited };
