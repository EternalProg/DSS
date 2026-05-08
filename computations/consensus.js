const { ObjectId } = require("mongodb");

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

function clampNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function computeAlphaWeights(experts, { mode = "competence" } = {}) {
  // mode:
  // - competence: alpha_i = K_i / sum(K)
  // - equal: alpha_i = 1/n
  const weights = new Map();
  if (!Array.isArray(experts) || experts.length === 0) return weights;

  if (mode === "equal") {
    const a = 1 / experts.length;
    for (const e of experts) {
      weights.set(String(e._id), a);
    }
    return weights;
  }

  let sum = 0;
  for (const e of experts) {
    const k = clampNumber(e.competenceK, { min: 0, max: 1e9 }) ?? 1;
    sum += k;
  }

  if (sum <= 0) {
    const a = 1 / experts.length;
    for (const e of experts) {
      weights.set(String(e._id), a);
    }
    return weights;
  }

  for (const e of experts) {
    const k = clampNumber(e.competenceK, { min: 0, max: 1e9 }) ?? 1;
    weights.set(String(e._id), k / sum);
  }

  return weights;
}

function weightedMedian(pairs) {
  // pairs: [{ value:number, weight:number }]
  // Returns smallest value where cumulative weight >= 0.5.
  const sorted = [...pairs].sort((a, b) => a.value - b.value);
  let cum = 0;
  for (const p of sorted) {
    cum += p.weight;
    if (cum >= 0.5) return p.value;
  }
  return sorted.length ? sorted[sorted.length - 1].value : null;
}

function e7Utilitarian({ valuesByExpertId, alphaByExpertId }) {
  const pairs = [];
  for (const [expertId, value] of valuesByExpertId.entries()) {
    const w = alphaByExpertId.get(expertId);
    if (!Number.isFinite(value) || !Number.isFinite(w) || w <= 0) continue;
    pairs.push({ value, weight: w, expertId });
  }

  if (!pairs.length) {
    return { ok: false, error: "NO_VALUES" };
  }

  const a = weightedMedian(pairs);
  let objective = 0;
  for (const p of pairs) {
    objective += p.weight * Math.abs(a - p.value);
  }
  return { ok: true, a, objective };
}

function e7Egalitarian({ valuesByExpertId, alphaByExpertId }) {
  // min_a max_i alpha_i * |a - a_i|
  // Solve by finding minimal t such that intersection of [a_i - t/alpha_i, a_i + t/alpha_i] is non-empty.
  const points = [];
  for (const [expertId, value] of valuesByExpertId.entries()) {
    const w = alphaByExpertId.get(expertId);
    if (!Number.isFinite(value) || !Number.isFinite(w) || w <= 0) continue;
    points.push({ expertId, value, w });
  }
  if (!points.length) {
    return { ok: false, error: "NO_VALUES" };
  }

  // Establish an upper bound for t.
  let minV = Infinity;
  let maxV = -Infinity;
  let minW = Infinity;
  for (const p of points) {
    minV = Math.min(minV, p.value);
    maxV = Math.max(maxV, p.value);
    minW = Math.min(minW, p.w);
  }
  const span = maxV - minV;
  let lo = 0;
  let hi = span * (minW > 0 ? minW : 1);
  if (hi === 0) {
    return { ok: true, a: minV, t: 0, interval: [minV, minV] };
  }

  function intersectionForT(t) {
    let left = -Infinity;
    let right = Infinity;
    for (const p of points) {
      const r = t / p.w;
      left = Math.max(left, p.value - r);
      right = Math.min(right, p.value + r);
    }
    return { left, right, ok: left <= right };
  }

  // Ensure hi is feasible.
  for (let i = 0; i < 30; i++) {
    const inter = intersectionForT(hi);
    if (inter.ok) break;
    hi *= 2;
  }

  // Binary search.
  for (let iter = 0; iter < 80; iter++) {
    const mid = (lo + hi) / 2;
    const inter = intersectionForT(mid);
    if (inter.ok) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  const { left, right } = intersectionForT(hi);
  const a = (left + right) / 2;
  return { ok: true, a, t: hi, interval: [left, right] };
}

const PSYCH_TYPE = {
  realist: {
    gamma1: 1,
    gamma2: 4,
    gamma3: 1,
    gamma4: 36
  },
  optimist: {
    gamma1: 3,
    gamma2: 0,
    gamma3: 2,
    gamma4: 25
  },
  pessimist: {
    gamma1: 2,
    gamma2: 0,
    gamma3: 3,
    gamma4: 25
  }
};

function getPsychTypeConfig(type) {
  const key = String(type ?? "").trim().toLowerCase();
  return PSYCH_TYPE[key] ?? PSYCH_TYPE.realist;
}

function e2EstimateForExpert({ optimistic, realistic, pessimistic, psychType }) {
  const cfg = getPsychTypeConfig(psychType);
  const denom = cfg.gamma1 + cfg.gamma2 + cfg.gamma3;
  const ai = (cfg.gamma1 * optimistic + cfg.gamma2 * realistic + cfg.gamma3 * pessimistic) / denom;
  // Uncertainty inside expert estimate.
  // The source formula references gamma4 as the uncertainty degree.
  // Commonly interpreted as: sigma_i^2 = (spread^2) / gamma4.
  const spread = pessimistic - optimistic;
  const sigma2 = (spread * spread) / cfg.gamma4;
  return { ai, sigma2, cfg };
}

// t-critical lookup for two-sided confidence intervals: 1 - p.
// Keys are df -> { p -> t } where p is error probability.
// Supports typical p used in labs; add more as needed.
const T_TABLE_TWO_SIDED = {
  1: { 0.1: 6.314, 0.05: 12.706, 0.01: 63.657 },
  2: { 0.1: 2.92, 0.05: 4.303, 0.01: 9.925 },
  3: { 0.1: 2.353, 0.05: 3.182, 0.01: 5.841 },
  4: { 0.1: 2.132, 0.05: 2.776, 0.01: 4.604 },
  5: { 0.1: 2.015, 0.05: 2.571, 0.01: 4.032 },
  6: { 0.1: 1.943, 0.05: 2.447, 0.01: 3.707 },
  7: { 0.1: 1.895, 0.05: 2.365, 0.01: 3.499 },
  8: { 0.1: 1.86, 0.05: 2.306, 0.01: 3.355 },
  9: { 0.1: 1.833, 0.05: 2.262, 0.01: 3.25 },
  10: { 0.1: 1.812, 0.05: 2.228, 0.01: 3.169 },
  11: { 0.1: 1.796, 0.05: 2.201, 0.01: 3.106 },
  12: { 0.1: 1.782, 0.05: 2.179, 0.01: 3.055 },
  13: { 0.1: 1.771, 0.05: 2.16, 0.01: 3.012 },
  14: { 0.1: 1.761, 0.05: 2.145, 0.01: 2.977 },
  15: { 0.1: 1.753, 0.05: 2.131, 0.01: 2.947 },
  16: { 0.1: 1.746, 0.05: 2.12, 0.01: 2.921 },
  17: { 0.1: 1.74, 0.05: 2.11, 0.01: 2.898 },
  18: { 0.1: 1.734, 0.05: 2.101, 0.01: 2.878 },
  19: { 0.1: 1.729, 0.05: 2.093, 0.01: 2.861 },
  20: { 0.1: 1.725, 0.05: 2.086, 0.01: 2.845 }
};

function tCriticalTwoSided({ df, p }) {
  const row = T_TABLE_TWO_SIDED[df];
  if (!row) return null;
  const key = Number(p);
  if (!Number.isFinite(key)) return null;
  return row[key] ?? null;
}

function groupByKey(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

function makeCellKey(alternativeId, criterionId) {
  return `${String(alternativeId)}-${String(criterionId)}`;
}

function calculateE7Matrix({ experts, expertEvaluations, variant = "utilitarian" }) {
  const alphaByExpertId = computeAlphaWeights(experts, { mode: "competence" });
  const byCell = groupByKey(expertEvaluations, (ev) =>
    makeCellKey(ev.alternativeId, ev.criterionId)
  );

  const cells = [];
  for (const [cellKey, evs] of byCell.entries()) {
    const valuesByExpertId = new Map();
    for (const ev of evs) {
      valuesByExpertId.set(String(ev.expertId), Number(ev.value));
    }

    const baseArgs = { valuesByExpertId, alphaByExpertId };
    const res =
      variant === "egalitarian" ? e7Egalitarian(baseArgs) : e7Utilitarian(baseArgs);
    if (!res.ok) continue;

    const [alternativeId, criterionId] = cellKey.split("-");
    cells.push({
      alternativeId: toObjectId(alternativeId),
      criterionId: toObjectId(criterionId),
      value: res.a,
      meta: {
        variant,
        ...(variant === "egalitarian"
          ? { t: res.t, interval: res.interval }
          : { objective: res.objective })
      }
    });
  }

  return { ok: true, method: "E7", variant, cells };
}

function calculateE1Matrix({ experts, expertEvaluations }) {
  // E1: a = sum(alpha_i * a_i), sigma^2 = sum(alpha_i * (a - a_i)^2)
  // Experts are isolated, no feedback, competence weights allowed.
  const alphaByExpertId = computeAlphaWeights(experts, { mode: "competence" });
  const byCell = groupByKey(expertEvaluations, (ev) =>
    makeCellKey(ev.alternativeId, ev.criterionId)
  );

  const cells = [];
  for (const [cellKey, evs] of byCell.entries()) {
    const pairs = [];
    let sumAlpha = 0;

    for (const ev of evs) {
      const eid = String(ev.expertId);
      const alpha = alphaByExpertId.get(eid);
      const value = Number(ev.value);
      if (!Number.isFinite(value)) continue;
      if (!Number.isFinite(alpha) || alpha <= 0) continue;
      pairs.push({ eid, alpha, value });
      sumAlpha += alpha;
    }

    if (pairs.length < 1) continue;

    // Normalize alpha inside the cell so weights sum to 1 for participating experts.
    const denom = sumAlpha > 0 ? sumAlpha : pairs.length;
    let a = 0;
    for (const p of pairs) {
      const w = sumAlpha > 0 ? p.alpha / denom : 1 / pairs.length;
      a += w * p.value;
    }

    let sigma2 = 0;
    for (const p of pairs) {
      const w = sumAlpha > 0 ? p.alpha / denom : 1 / pairs.length;
      const d = a - p.value;
      sigma2 += w * d * d;
    }

    const [alternativeId, criterionId] = cellKey.split("-");
    cells.push({
      alternativeId: toObjectId(alternativeId),
      criterionId: toObjectId(criterionId),
      value: a,
      meta: {
        sigma2,
        sigma: Math.sqrt(sigma2),
        expertsCount: pairs.length,
        weightsNormalized: true
      }
    });
  }

  return { ok: true, method: "E1", cells };
}

function calculateE2Matrix({ experts, expertTriads, p = null }) {
  const alphaByExpertId = computeAlphaWeights(experts, { mode: "competence" });
  const expertsById = new Map(experts.map((e) => [String(e._id), e]));

  const byCell = groupByKey(expertTriads, (t) =>
    makeCellKey(t.alternativeId, t.criterionId)
  );

  const cells = [];
  for (const [cellKey, triads] of byCell.entries()) {
    const expertEstimates = [];
    for (const t of triads) {
      const eid = String(t.expertId);
      const expert = expertsById.get(eid);
      if (!expert) continue;

      const optimistic = clampNumber(t.optimistic);
      const realistic = clampNumber(t.realistic);
      const pessimistic = clampNumber(t.pessimistic);
      if (optimistic == null || realistic == null || pessimistic == null) continue;
      if (!(optimistic <= realistic && realistic <= pessimistic)) {
        // Keep rule strict; if inputs violate triangle ordering, skip.
        continue;
      }

      const alpha = alphaByExpertId.get(eid);
      if (!Number.isFinite(alpha) || alpha <= 0) continue;
      const { ai, sigma2, cfg } = e2EstimateForExpert({
        optimistic,
        realistic,
        pessimistic,
        psychType: expert.psychType
      });
      expertEstimates.push({ eid, alpha, ai, sigma2, cfg });
    }

    if (expertEstimates.length < 2) continue;

    const n = expertEstimates.length;
    let a = 0;
    for (const e of expertEstimates) {
      a += e.alpha * e.ai;
    }

    let sigma2 = 0;
    for (const e of expertEstimates) {
      sigma2 += e.alpha * e.sigma2;
    }
    for (const e of expertEstimates) {
      const d = a - e.ai;
      sigma2 += e.alpha * d * d;
    }

    const sigma = Math.sqrt(sigma2);

    let confidence = null;
    if (p != null) {
      const pNum = clampNumber(p, { min: 0.000001, max: 0.5 });
      if (pNum != null) {
        const df = n - 1;
        const t = tCriticalTwoSided({ df, p: pNum });
        if (t != null) {
          const delta = (t * sigma) / Math.sqrt(n);
          confidence = {
            p: pNum,
            df,
            t,
            delta,
            interval: [a - delta, a + delta]
          };
        } else {
          confidence = {
            p: pNum,
            df,
            error:
              "T_TABLE_MISSING",
            hint:
              "Для цього p/df немає табличного t. Використайте p=0.1 або 0.05 або 0.01 і df<=20."
          };
        }
      }
    }

    const [alternativeId, criterionId] = cellKey.split("-");
    cells.push({
      alternativeId: toObjectId(alternativeId),
      criterionId: toObjectId(criterionId),
      value: a,
      meta: {
        sigma2,
        sigma,
        expertsCount: n,
        confidence
      }
    });
  }

  return { ok: true, method: "E2", cells };
}

module.exports = {
  computeAlphaWeights,
  e7Utilitarian,
  e7Egalitarian,
  calculateE7Matrix,
  calculateE1Matrix,
  calculateE2Matrix,
  getPsychTypeConfig
};
