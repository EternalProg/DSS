const { ObjectId } = require("mongodb");
const { parseCsv } = require("./csvImport");

function clampNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function computeAlphaWeights(experts, { mode = "competence" } = {}) {
  const weights = new Map();
  if (!Array.isArray(experts) || experts.length === 0) return weights;

  if (mode === "equal") {
    const a = 1 / experts.length;
    for (const e of experts) weights.set(String(e._id), a);
    return weights;
  }

  let sum = 0;
  for (const e of experts) {
    const k = clampNumber(e.competenceK, { min: 0, max: 1e9 }) ?? 1;
    sum += k;
  }
  if (sum <= 0) {
    const a = 1 / experts.length;
    for (const e of experts) weights.set(String(e._id), a);
    return weights;
  }
  for (const e of experts) {
    const k = clampNumber(e.competenceK, { min: 0, max: 1e9 }) ?? 1;
    weights.set(String(e._id), k / sum);
  }
  return weights;
}

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

function plurality({ ballots, alphaByExpertId, criterionIds }) {
  const scores = new Map(criterionIds.map((id) => [String(id), 0]));
  for (const b of ballots) {
    const w = alphaByExpertId.get(String(b.expertId)) ?? 0;
    if (w <= 0) continue;
    for (const [cid, rank] of b.ranks.entries()) {
      if (rank === 1) scores.set(cid, (scores.get(cid) ?? 0) + w);
    }
  }
  return scores;
}

function borda({ ballots, alphaByExpertId, criterionIds }) {
  const m = criterionIds.length;
  const scores = new Map(criterionIds.map((id) => [String(id), 0]));
  for (const b of ballots) {
    const w = alphaByExpertId.get(String(b.expertId)) ?? 0;
    if (w <= 0) continue;
    for (const [cid, rank] of b.ranks.entries()) {
      const pts = m - Number(rank);
      scores.set(cid, (scores.get(cid) ?? 0) + w * pts);
    }
  }
  return scores;
}

function pairwiseMatrix({ ballots, alphaByExpertId, criterionIds }) {
  const ids = criterionIds.map((x) => String(x));
  const P = new Map();
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue;
      P.set(`${a}|${b}`, 0);
    }
  }
  for (const ballot of ballots) {
    const w = alphaByExpertId.get(String(ballot.expertId)) ?? 0;
    if (w <= 0) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (i === j) continue;
        const a = ids[i];
        const b = ids[j];
        const ra = ballot.ranks.get(a);
        const rb = ballot.ranks.get(b);
        if (!Number.isFinite(ra) || !Number.isFinite(rb)) continue;
        if (ra < rb) {
          P.set(`${a}|${b}`, (P.get(`${a}|${b}`) ?? 0) + w);
        }
      }
    }
  }
  return { ids, P };
}

function copeland({ ballots, alphaByExpertId, criterionIds }) {
  const { ids, P } = pairwiseMatrix({ ballots, alphaByExpertId, criterionIds });
  const score = new Map(ids.map((id) => [id, 0]));
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const pab = P.get(`${a}|${b}`) ?? 0;
      const pba = P.get(`${b}|${a}`) ?? 0;
      if (pab > pba) {
        score.set(a, (score.get(a) ?? 0) + 1);
        score.set(b, (score.get(b) ?? 0) - 1);
      } else if (pba > pab) {
        score.set(b, (score.get(b) ?? 0) + 1);
        score.set(a, (score.get(a) ?? 0) - 1);
      }
    }
  }
  return score;
}

function simpson({ ballots, alphaByExpertId, criterionIds }) {
  const { ids, P } = pairwiseMatrix({ ballots, alphaByExpertId, criterionIds });
  const score = new Map();
  for (const a of ids) {
    let worst = Infinity;
    for (const b of ids) {
      if (a === b) continue;
      const pab = P.get(`${a}|${b}`) ?? 0;
      worst = Math.min(worst, pab);
    }
    score.set(a, worst === Infinity ? 0 : worst);
  }
  return score;
}

function scoresToWeights(scoresMap, { min = 1, max = 10 } = {}) {
  const entries = Array.from(scoresMap.entries());
  let sMin = Infinity;
  let sMax = -Infinity;
  for (const [, v] of entries) {
    if (!Number.isFinite(v)) continue;
    sMin = Math.min(sMin, v);
    sMax = Math.max(sMax, v);
  }
  const span = sMax - sMin;
  const weights = new Map();
  for (const [id, v] of entries) {
    if (!Number.isFinite(v)) {
      weights.set(id, min);
      continue;
    }
    if (span === 0) {
      weights.set(id, Math.round((min + max) / 2));
      continue;
    }
    const t = (v - sMin) / span;
    const w = min + t * (max - min);
    weights.set(id, Math.max(min, Math.min(max, Math.round(w))));
  }
  return weights;
}

async function importVotingCsv({ db, csvText }) {
  const rows = parseCsv(csvText);
  if (!rows.length) {
    return { ok: false, message: "CSV порожній.", errors: [{ code: "CSV_EMPTY" }] };
  }

  const header = rows[0].map((x) => String(x ?? "").trim());
  if (header.length < 2) {
    return { ok: false, message: "CSV має містити колонки експерта та критерії.", errors: [{ code: "BAD_HEADER" }] };
  }

  const criteria = await db.collection("criteria").find({}).toArray();
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

    const now = new Date();
    const up = await db.collection("experts").updateOne(
      { code: expertCode },
      {
        $set: { code: expertCode, name: expertCode, updatedAt: now },
        $setOnInsert: { competenceK: 1, createdAt: now }
      },
      { upsert: true }
    );
    if (up.upsertedCount) expertsCreated++;
    const expertDoc = await db.collection("experts").findOne({ code: expertCode });
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

    // Persist per-expert criterion ranks (derived if needed)
    for (const col of critCols) {
      const rank = ranks.get(String(col.criterionId));
      if (!Number.isFinite(rank)) continue;
      const res = await db.collection("expertCriterionRankings").updateOne(
        { expertId: expertDoc._id, criterionId: col.criterionId },
        {
          $set: { rank: Number(rank), updatedAt: now },
          $setOnInsert: { createdAt: now }
        },
        { upsert: true }
      );
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

function calculateVotingWeights({ method, ballots, experts, criterionIds }) {
  const alphaByExpertId = computeAlphaWeights(experts, { mode: "competence" });
  const m = String(method || "").trim().toLowerCase();
  let scores;
  if (m === "plurality") scores = plurality({ ballots, alphaByExpertId, criterionIds });
  else if (m === "borda") scores = borda({ ballots, alphaByExpertId, criterionIds });
  else if (m === "copeland") scores = copeland({ ballots, alphaByExpertId, criterionIds });
  else if (m === "simpson") scores = simpson({ ballots, alphaByExpertId, criterionIds });
  else return { ok: false, error: "UNKNOWN_METHOD" };

  const weights = scoresToWeights(scores, { min: 1, max: 10 });
  const ranked = Array.from(scores.entries())
    .map(([criterionId, score]) => ({ criterionId, score, weight: weights.get(criterionId) }))
    .sort((a, b) => b.score - a.score);
  return { ok: true, scores, weights, ranked };
}

async function applyWeightsToCriteria({ db, weightsByCriterionId }) {
  const now = new Date();
  const ops = [];
  for (const [criterionIdStr, weight] of weightsByCriterionId.entries()) {
    if (!ObjectId.isValid(criterionIdStr)) continue;
    const w = Number(weight);
    if (!Number.isFinite(w)) continue;
    ops.push({
      updateOne: {
        filter: { _id: new ObjectId(criterionIdStr) },
        update: { $set: { weight: w, weightSource: "voting", updatedAt: now } }
      }
    });
  }
  if (!ops.length) return { ok: true, updated: 0 };
  const r = await db.collection("criteria").bulkWrite(ops, { ordered: false });
  return { ok: true, updated: r.modifiedCount ?? 0 };
}

module.exports = {
  importVotingCsv,
  calculateVotingWeights,
  applyWeightsToCriteria
};
