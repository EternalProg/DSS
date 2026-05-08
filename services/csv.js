function detectDelimiter(text) {
  const firstLine = String(text ?? "").split(/\r?\n/)[0] ?? "";

  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    const next = firstLine[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        i++;
        continue;
      }
      if (ch === '"') inQuotes = false;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") counts[","]++;
    else if (ch === ";") counts[";"]++;
    else if (ch === "\t") counts["\t"]++;
  }

  if (counts["\t"] > counts[","] && counts["\t"] > counts[";"]) return "\t";
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

// Minimal RFC4180-style parsing: delimiter, quotes, newlines.
function parseSeparatedValues(text, delimiter) {
  const input = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      cell += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (ch === "\r") {
      // Ignore CR; handle CRLF by ignoring the CR and processing LF.
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  rows.push(row);

  // Drop trailing empty lines.
  while (rows.length && rows[rows.length - 1].every((v) => String(v ?? "").trim() === "")) {
    rows.pop();
  }

  return rows;
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  return parseSeparatedValues(text, delimiter);
}

module.exports = { parseCsv };
