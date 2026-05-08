// Keep MongoDB specifics out of parsing logic as much as possible.

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ")
    // Normalize dash variants (Google Sheets/Forms often export en/em dashes)
    .replace(/[–—]/g, "-")
    // Normalize Ukrainian/Latin I variants common in CSV headers
    .replace(/ПIБ/g, "ПІБ");
}

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
      if (ch === '"') {
        inQuotes = false;
      }
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

function getCell(row, idx) {
  if (!row || idx == null) return "";
  return String(row[idx] ?? "").trim();
}

function parseAlternativeFromHeader(header) {
  // Google Forms export uses: "... [A1 Moodle]" (or similar)
  // We treat everything inside [] as a label and extract the name after A<digits>.
  const match = String(header).match(/\[\s*(A\d+)\s+([^\]]+?)\s*\]\s*$/i);
  if (!match) return null;

  const altCode = match[1].toUpperCase();
  const altName = match[2].trim();
  return { altCode, altName };
}

function parseCriterionFromHeader(header) {
  // Extract criterion code: "... за C1 ..." OR "... [C1 ...]".
  const h = String(header);
  const codeMatch = h.match(/\bC\s*(\d+)\b/i);
  if (!codeMatch) return null;
  const criterionCode = `C${codeMatch[1]}`.toUpperCase();
  return { criterionCode };
}

function isRankingHeader(header) {
  return /Ранжуйте альтернативи/i.test(String(header));
}

function buildHeaderIndexMap(headers) {
  const map = new Map();
  headers.forEach((h, idx) => {
    map.set(normalizeHeader(h), idx);
  });
  return map;
}

function makeImportError(code, message, hint) {
  return { code, message, hint };
}

async function importExpertCsv({ db, csvText, mode = "replace" } = {}) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      ok: false,
      errors: [
        makeImportError(
          "CSV_EMPTY",
          "CSV-файл не містить даних (потрібен рядок заголовків + хоча б 1 рядок).",
          "Експортуйте відповіді Google Forms у CSV і завантажте отриманий файл."
        )
      ]
    };
  }

  const headers = rows[0].map(normalizeHeader);
  const headerIndex = buildHeaderIndexMap(headers);

  // Resolve required base columns (we accept a few variants).
  const expertCodeHeaderCandidates = [
    "Код експерта",
    "Код експерта (наприклад, E1–E7) або ПІБ",
    "Код експерта (наприклад, E1-E7) або ПІБ",
    "Код експерта (наприклад, E1–E7) або ПIБ",
    "Код експерта (наприклад, E1-E7) або ПIБ",
    "ПІБ",
    "ПIБ"
  ];
  const roleHeaderCandidates = ["Роль", "Role"];

  const expertCodeHeader = expertCodeHeaderCandidates
    .map(normalizeHeader)
    .find((h) => headerIndex.has(h));
  const roleHeader = roleHeaderCandidates
    .map(normalizeHeader)
    .find((h) => headerIndex.has(h));

  const errors = [];
  if (!expertCodeHeader) {
    errors.push(
      makeImportError(
        "CSV_MISSING_EXPERT",
        "У CSV не знайдено колонку з кодом експерта (E1..E7) або ПІБ.",
        `Додайте колонку "${expertCodeHeaderCandidates[1]}" (або "${expertCodeHeaderCandidates[0]}") у перший рядок CSV.`
      )
    );
  }
  if (!roleHeader) {
    errors.push(
      makeImportError(
        "CSV_MISSING_ROLE",
        "У CSV не знайдено колонку " + '"Роль"' + ".",
        "Переконайтесь, що у Google Form є питання/поле 'Роль', і CSV експортується з заголовками."
      )
    );
  }
  if (errors.length) {
    return { ok: false, errors };
  }

  const expertCodeIdx = headerIndex.get(expertCodeHeader);
  const roleIdx = headerIndex.get(roleHeader);

  // Build mapping for evaluation columns.
  const evaluationColumns = [];
  const rankingColumns = [];

  headers.forEach((header, idx) => {
    if (idx === expertCodeIdx || idx === roleIdx) return;

    if (isRankingHeader(header)) {
      const alt = parseAlternativeFromHeader(header);
      if (alt) {
        rankingColumns.push({ idx, ...alt });
      }
      return;
    }

    const crit = parseCriterionFromHeader(header);
    const alt = parseAlternativeFromHeader(header);
    if (!crit || !alt) return;

    evaluationColumns.push({ idx, ...crit, ...alt, header });
  });

  if (!evaluationColumns.length) {
    return {
      ok: false,
      errors: [
        makeImportError(
          "CSV_NO_EVALUATIONS",
          "У CSV не знайдено колонок оцінок у форматі Google Forms (з Ck та [A# Назва]).",
          "Перевірте, що заголовки колонок містять C1..C6 і в кінці мають [A1 Moodle], [A2 ...] тощо."
        )
      ]
    };
  }

  // Validate referenced alternatives and criteria exist.
  const uniqueAltNames = Array.from(
    new Set([
      ...evaluationColumns.map((c) => c.altName),
      ...rankingColumns.map((c) => c.altName)
    ])
  );
  const uniqueCritCodes = Array.from(
    new Set(evaluationColumns.map((c) => c.criterionCode))
  );

  // Map C1.. to actual criteria in DB.
  // Preferred: criteria have explicit `code` field (e.g., { code: "C1" }).
  // Fallback: criterion name starts with "C1" / "C2" ...
  const [alts, criteria] = await Promise.all([
    db.collection("alternatives").find({ name: { $in: uniqueAltNames } }).toArray(),
    db.collection("criteria").find({}).toArray()
  ]);

  const altByName = new Map(alts.map((a) => [a.name, a]));
  const missingAlts = uniqueAltNames.filter((name) => !altByName.has(name));
  if (missingAlts.length) {
    return {
      ok: false,
      errors: missingAlts.map((name) =>
        makeImportError(
          "ALT_NOT_FOUND",
          `Альтернатива не знайдена у системі: "${name}".`,
          "Створіть альтернативу з точно такою ж назвою (без зайвих пробілів) або виправте назву в CSV."
        )
      )
    };
  }

  // Criterion matching: prefer explicit code field if present, otherwise name starts with "C#".
  const critByCode = new Map();
  for (const c of criteria) {
    if (c.code) {
      critByCode.set(String(c.code).toUpperCase(), c);
      continue;
    }
    const m = String(c.name).match(/^\s*(C\d+)\b/i);
    if (m) {
      critByCode.set(m[1].toUpperCase(), c);
    }
  }

  const missingCrit = uniqueCritCodes.filter((code) => !critByCode.has(code));
  if (missingCrit.length) {
    return {
      ok: false,
      errors: missingCrit.map((code) =>
        makeImportError(
          "CRIT_NOT_FOUND",
          `Критерій не знайдений у системі за кодом ${code}.`,
          "Задайте критерії з назвами, що починаються з 'C1', 'C2', ... (наприклад 'C1 Вартість'), або додайте поле code='C1' для критеріїв у БД."
        )
      )
    };
  }

  const validationErrors = [];

  // First pass: validate all data (fail hard with user-friendly messages).
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const expertCodeRaw = getCell(row, expertCodeIdx);
    if (!expertCodeRaw) {
      validationErrors.push(
        makeImportError(
          "ROW_MISSING_EXPERT",
          `Рядок ${r + 1}: порожній код експерта/ПІБ.`,
          "Заповніть колонку з кодом експерта (E1..E7) або ПІБ у цьому рядку."
        )
      );
      continue;
    }

    for (const col of evaluationColumns) {
      const raw = getCell(row, col.idx);
      if (raw === "") {
        validationErrors.push(
          makeImportError(
            "CELL_EMPTY",
            `Рядок ${r + 1}: порожня оцінка у колонці "${col.header}".`,
            "Заповніть всі оцінки (1-10) у Google Form або виправте CSV."
          )
        );
        continue;
      }

      const value = Number(raw.replace(",", "."));
      if (!Number.isFinite(value) || value < 1 || value > 10) {
        validationErrors.push(
          makeImportError(
            "CELL_INVALID",
            `Рядок ${r + 1}: некоректна оцінка "${raw}" у колонці "${col.header}" (очікується 1-10).`,
            "Перевірте, що CSV містить числа 1-10 без зайвих символів."
          )
        );
      }
    }

    if (rankingColumns.length) {
      // Rankings are optional; validate if provided.
      for (const rankCol of rankingColumns) {
        const rawRank = getCell(row, rankCol.idx);
        if (rawRank === "") {
          validationErrors.push(
            makeImportError(
              "RANK_EMPTY",
              `Рядок ${r + 1}: порожній ранг у колонці ранжування [${rankCol.altCode} ${rankCol.altName}].`,
              "Заповніть ранги 1..4 у Google Form або виправте CSV."
            )
          );
          continue;
        }
        const rankValue = Number(rawRank);
        if (!Number.isInteger(rankValue) || rankValue < 1 || rankValue > 4) {
          validationErrors.push(
            makeImportError(
              "RANK_INVALID",
              `Рядок ${r + 1}: некоректний ранг "${rawRank}" для [${rankCol.altCode} ${rankCol.altName}] (очікується 1-4).`,
              "Перевірте, що ранги задаються як цілі числа від 1 до 4."
            )
          );
        }
      }

      // Check duplicate ranks within row if all ranks are present.
      const ranks = rankingColumns.map((c) => ({
        altName: c.altName,
        raw: getCell(row, c.idx)
      }));
      if (ranks.every((x) => x.raw !== "")) {
        const nums = ranks.map((x) => Number(x.raw));
        const uniq = new Set(nums);
        if (uniq.size !== nums.length) {
          validationErrors.push(
            makeImportError(
              "RANK_DUPLICATES",
              `Рядок ${r + 1}: дублікати рангів у блоці ранжування (кожна альтернатива має мати унікальний ранг 1..4).`,
              "Виправте ранжування так, щоб значення 1,2,3,4 зустрічалися рівно по одному разу."
            )
          );
        }
      }
    }
  }

  if (validationErrors.length) {
    return {
      ok: false,
      errors: validationErrors.slice(0, 50),
      meta: {
        totalErrors: validationErrors.length
      }
    };
  }

  // Replace mode: clear the whole expert dataset only after validation succeeded.
  if (mode === "replace") {
    await Promise.all([
      db.collection("expertEvaluations").deleteMany({}),
      db.collection("expertRankings").deleteMany({}),
      db.collection("expertTriads").deleteMany({}),
      db.collection("expertCriterionRankings").deleteMany({}),
      db.collection("experts").deleteMany({})
    ]);
  }

  let expertsCreated = 0;
  let expertsUpdated = 0;
  let expertEvaluationsUpserted = 0;
  let rankingRowsParsed = 0;

  // Second pass: perform the upserts (should be safe after validation).
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const expertCodeRaw = getCell(row, expertCodeIdx);
    const roleRaw = getCell(row, roleIdx);

    if (!expertCodeRaw) continue;

    const expertCode = expertCodeRaw.trim();
    const role = roleRaw.trim();

    const now = new Date();
    const expertUpsert = await db.collection("experts").updateOne(
      { code: expertCode },
      {
        $set: {
          code: expertCode,
          name: expertCode,
          role,
          updatedAt: now
        },
        $setOnInsert: {
          competenceK: 1,
          createdAt: now
        }
      },
      { upsert: true }
    );
    if (expertUpsert.upsertedCount) {
      expertsCreated++;
    } else if (expertUpsert.matchedCount) {
      expertsUpdated++;
    }

    const expertDoc = await db.collection("experts").findOne({ code: expertCode });
    if (!expertDoc) continue;

    // Upsert each evaluation.
    for (const col of evaluationColumns) {
      const raw = getCell(row, col.idx);
      if (raw === "") continue;
      const value = Number(raw.replace(",", "."));
      if (!Number.isFinite(value) || value < 1 || value > 10) continue;

      const alternative = altByName.get(col.altName);
      const criterion = critByCode.get(col.criterionCode);

      const upsertResult = await db.collection("expertEvaluations").updateOne(
        {
          expertId: expertDoc._id,
          alternativeId: alternative._id,
          criterionId: criterion._id
        },
        {
          $set: {
            value,
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: now
          }
        },
        { upsert: true }
      );

      if (upsertResult.upsertedCount || upsertResult.modifiedCount) {
        expertEvaluationsUpserted++;
      }
    }

    if (rankingColumns.length) {
      rankingRowsParsed++;

      // Persist ranking input as-is (for future ranking-based methods).
      for (const rankCol of rankingColumns) {
        const rawRank = getCell(row, rankCol.idx);
        if (rawRank === "") continue;
        const rank = Number(rawRank);
        if (!Number.isInteger(rank)) continue;

        const alternative = altByName.get(rankCol.altName);
        if (!alternative) continue;

        await db.collection("expertRankings").updateOne(
          {
            expertId: expertDoc._id,
            alternativeId: alternative._id
          },
          {
            $set: {
              rank,
              updatedAt: now
            },
            $setOnInsert: {
              createdAt: now
            }
          },
          { upsert: true }
        );
      }
    }
  }

  return {
    ok: true,
    summary: {
      expertsCreated,
      expertsUpdated,
      expertEvaluationsUpserted,
      rankingRowsParsed
    }
  };
}

module.exports = {
  parseCsv,
  importExpertCsv
};
