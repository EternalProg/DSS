const { parseCsv } = require("./csv");
const alternativesRepo = require("../data/alternativesRepo");
const criteriaRepo = require("../data/criteriaRepo");
const expertsRepo = require("../data/expertsRepo");
const expertEvaluationsRepo = require("../data/expertEvaluationsRepo");
const expertRankingsRepo = require("../data/expertRankingsRepo");
const expertTriadsRepo = require("../data/expertTriadsRepo");
const expertCriterionRankingsRepo = require("../data/expertCriterionRankingsRepo");

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/ПIБ/g, "ПІБ");
}

function getCell(row, idx) {
  if (!row || idx == null) return "";
  return String(row[idx] ?? "").trim();
}

function parseAlternativeFromHeader(header) {
  const match = String(header).match(/\[\s*(A\d+)\s+([^\]]+?)\s*\]\s*$/i);
  if (!match) return null;
  const altCode = match[1].toUpperCase();
  const altName = match[2].trim();
  return { altCode, altName };
}

function parseCriterionFromHeader(header) {
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

async function importExpertCsv({ csvText, mode = "replace" } = {}) {
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
  const roleHeader = roleHeaderCandidates.map(normalizeHeader).find((h) => headerIndex.has(h));

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
        'У CSV не знайдено колонку "Роль".',
        "Переконайтесь, що у Google Form є питання/поле 'Роль', і CSV експортується з заголовками."
      )
    );
  }
  if (errors.length) return { ok: false, errors };

  const expertCodeIdx = headerIndex.get(expertCodeHeader);
  const roleIdx = headerIndex.get(roleHeader);

  const evaluationColumns = [];
  const rankingColumns = [];

  headers.forEach((header, idx) => {
    if (idx === expertCodeIdx || idx === roleIdx) return;

    if (isRankingHeader(header)) {
      const alt = parseAlternativeFromHeader(header);
      if (alt) rankingColumns.push({ idx, ...alt });
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

  const uniqueAltNames = Array.from(
    new Set([...evaluationColumns.map((c) => c.altName), ...rankingColumns.map((c) => c.altName)])
  );
  const uniqueCritCodes = Array.from(new Set(evaluationColumns.map((c) => c.criterionCode)));

  const [alts, criteria] = await Promise.all([alternativesRepo.listAll(), criteriaRepo.listAll()]);
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

  const critByCode = new Map();
  for (const c of criteria) {
    if (c.code) {
      critByCode.set(String(c.code).toUpperCase(), c);
      continue;
    }
    const m = String(c.name).match(/^\s*(C\d+)\b/i);
    if (m) critByCode.set(m[1].toUpperCase(), c);
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

      const ranks = rankingColumns.map((c) => ({ altName: c.altName, raw: getCell(row, c.idx) }));
      if (ranks.every((x) => x.raw !== "")) {
        const nums = ranks.map((x) => Number(x.raw));
        if (new Set(nums).size !== nums.length) {
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
    return { ok: false, errors: validationErrors.slice(0, 50), meta: { totalErrors: validationErrors.length } };
  }

  if (mode === "replace") {
    await Promise.all([
      expertEvaluationsRepo.deleteAll(),
      expertRankingsRepo.deleteAll(),
      expertTriadsRepo.deleteAll(),
      expertCriterionRankingsRepo.deleteAll(),
      expertsRepo.deleteAll()
    ]);
  }

  let expertsCreated = 0;
  let expertsUpdated = 0;
  let expertEvaluationsUpserted = 0;
  let rankingRowsParsed = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const expertCodeRaw = getCell(row, expertCodeIdx);
    const roleRaw = getCell(row, roleIdx);
    if (!expertCodeRaw) continue;

    const expertCode = expertCodeRaw.trim();
    const role = roleRaw.trim();

    const { doc: expertDoc, upserted, matched } = await expertsRepo.upsertAndFetch({
      code: expertCode,
      name: expertCode,
      role
    });
    if (!expertDoc) continue;
    if (upserted) expertsCreated++;
    else if (matched) expertsUpdated++;

    const now = new Date();
    for (const col of evaluationColumns) {
      const raw = getCell(row, col.idx);
      if (raw === "") continue;
      const value = Number(raw.replace(",", "."));
      if (!Number.isFinite(value) || value < 1 || value > 10) continue;

      const alternative = altByName.get(col.altName);
      const criterion = critByCode.get(col.criterionCode);
      const upsertResult = await expertEvaluationsRepo.upsertOne({
        expertId: expertDoc._id,
        alternativeId: alternative._id,
        criterionId: criterion._id,
        value,
        now
      });
      if (upsertResult.upsertedCount || upsertResult.modifiedCount) expertEvaluationsUpserted++;
    }

    if (rankingColumns.length) {
      rankingRowsParsed++;
      for (const rankCol of rankingColumns) {
        const rawRank = getCell(row, rankCol.idx);
        if (rawRank === "") continue;
        const rank = Number(rawRank);
        if (!Number.isInteger(rank)) continue;
        const alternative = altByName.get(rankCol.altName);
        if (!alternative) continue;
        await expertRankingsRepo.upsertOne({ expertId: expertDoc._id, alternativeId: alternative._id, rank, now });
      }
    }
  }

  return {
    ok: true,
    summary: { expertsCreated, expertsUpdated, expertEvaluationsUpserted, rankingRowsParsed }
  };
}

module.exports = { importExpertCsv };
