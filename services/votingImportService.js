const { parseCsv } = require("./csv");
const criteriaRepo = require("../data/criteriaRepo");
const expertsRepo = require("../data/expertsRepo");
const expertCriterionRankingsRepo = require("../data/expertCriterionRankingsRepo");

function parseCriterionCode(header) {
  const h = String(header || "").trim().toUpperCase();
  const m = h.match(/\bC\d+\b/);
  return m ? m[0] : null;
}

function buildRowRankingsFromScores(scoreEntries) {
  // scoreEntries: [{ criterionId, score:number }]
  // Higher score => more important => rank 1.
  const sorted = [...scoreEntries].sort((a, b) => b.score - a.score);
  const ranks = new Map();
  for (let i = 0; i < sorted.length; i++) {
    ranks.set(String(sorted[i].criterionId), i + 1);
  }
  return ranks;
}

function isValidRanking(values, m) {
  if (values.length !== m) return false;
  if (!values.every((v) => Number.isInteger(v) && v >= 1 && v <= m)) return false;
  return new Set(values).size === m;
}

async function importVotingCsv({ csvText } = {}) {
  const rows = parseCsv(csvText);
  if (!rows.length) {
    return { ok: false, message: "CSV порожній.", errors: [{ code: "CSV_EMPTY" }] };
  }

  const header = rows[0].map((x) => String(x ?? "").trim());
  if (header.length < 2) {
    return { ok: false, message: "CSV має містити колонки експерта та критерії.", errors: [{ code: "BAD_HEADER" }] };
  }

  const criteria = await criteriaRepo.listAll();
  const critByCode = new Map(criteria.map((c) => [String(c.code || "").toUpperCase(), c]));

  const critCols = [];
  const missingCodes = [];
  for (let i = 1; i < header.length; i++) {
    const code = parseCriterionCode(header[i]);
    if (!code) continue;
    const crit = critByCode.get(code);
    if (!crit) {
      missingCodes.push(code);
      continue;
    }
    critCols.push({ idx: i, code, criterionId: crit._id });
  }

  if (!critCols.length) {
    return {
      ok: false,
      message: "У CSV не знайдено колонок критеріїв (C1..Cn).",
      errors: [{ code: "NO_CRITERIA_COLUMNS", hint: "Додайте колонки C1, C2, ... у першому рядку." }]
    };
  }

  const warnings = [];
  if (missingCodes.length) {
    const uniq = Array.from(new Set(missingCodes));
    warnings.push({
      code: "UNKNOWN_CRITERIA_CODES",
      message: `У CSV є невідомі коди критеріїв: ${uniq.join(", ")}.`,
      hint: "Перевірте, що у критеріях задано code=C# і що коди у CSV збігаються."
    });
  }

  let expertsCreated = 0;
  let votesUpserted = 0;
  let rowsParsed = 0;
  const ballots = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const expertCodeRaw = String(row[0] ?? "").trim();
    if (!expertCodeRaw) continue;
    const expertCode = expertCodeRaw;

    const { doc: expertDoc, upserted } = await expertsRepo.upsertAndFetch({
      code: expertCode,
      name: expertCode,
      role: ""
    });
    if (upserted) expertsCreated++;
    if (!expertDoc) continue;

    const values = [];
    const scoreEntries = [];
    for (const col of critCols) {
      const raw = String(row[col.idx] ?? "").trim();
      if (!raw) continue;
      const num = Number(raw.replace(",", "."));
      if (!Number.isFinite(num)) continue;
      values.push(num);
      scoreEntries.push({ criterionId: col.criterionId, score: num });
    }

    if (scoreEntries.length !== critCols.length) {
      // Must include all criteria cols to build a total order.
      continue;
    }

    const m = critCols.length;
    const asRanks = isValidRanking(values, m);
    const ranks = asRanks
      ? new Map(scoreEntries.map((x) => [String(x.criterionId), Number(x.score)]))
      : buildRowRankingsFromScores(scoreEntries);

    ballots.push({ expertId: expertDoc._id, ranks });
    rowsParsed++;

    const now = new Date();
    for (const col of critCols) {
      const rank = ranks.get(String(col.criterionId));
      if (!Number.isFinite(rank)) continue;
      const res = await expertCriterionRankingsRepo.upsertOne({
        expertId: expertDoc._id,
        criterionId: col.criterionId,
        rank: Number(rank),
        now
      });
      if (res.upsertedCount || res.modifiedCount) votesUpserted++;
    }
  }

  return {
    ok: true,
    criteriaCount: critCols.length,
    ballots,
    summary: { expertsCreated, rowsParsed, votesUpserted },
    warnings
  };
}

module.exports = {
  importVotingCsv
};
