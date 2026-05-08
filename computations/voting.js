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

module.exports = { calculateVotingWeights };
