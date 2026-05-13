/**
 * Голосування — методи визначення ваг критеріїв на основі експертних ранжувань.
 *
 * Експерти ранжують критерії: rank = 1 означає "найважливіший".
 * З цих ранжувань обчислюються бали, які потім конвертуються у ваги [1..10].
 *
 * Методи (стор. 94 підручника):
 *   - Plurality (M1): тільки перші місця
 *   - Borda (M2):      всі позиції, pts = m − rank
 *   - Copeland (M3):   попарний "турнір" (перемога/поразка)
 *   - Simpson (M4):    максимінна попарна підтримка
 */

function clampNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

// Ваги компетентності експертів: αᵢ = Kᵢ / ΣK (або αᵢ = 1/n для режиму "equal")
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

/**
 * PLURALITY (M1) — Відносна більшість.
 * Враховуються ТІЛЬКИ перші місця (rank === 1).
 * score(cⱼ) = Σ αᵢ для всіх експертів, що поставили cⱼ на 1 місце.
 */
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

/**
 * BORDA (M2) — Метод Борда.
 * Для m критеріїв: pts = m − rank (найкращий = m−1 балів).
 * score(cⱼ) = Σ αᵢ · (m − rankᵢⱼ)
 * Враховує всі позиції в ранжуванні.
 */
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

/**
 * Попарна матриця P[a|b] — допоміжна для Copeland та Simpson.
 * P[a|b] = сума компетентностей експертів, які поставили a ВИЩЕ (rank(a) < rank(b)) за b.
 */
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

/**
 * COPELAND (M3) — Метод Копленда.
 *
 * Для кожної пари (a, b):
 *   якщо P[a|b] > P[b|a] → a перемагає (+1), b програє (−1)
 *   якщо P[b|a] > P[a|b] → b перемагає (+1), a програє (−1)
 *
 * score(a) = (#перемог) − (#поразок)
 */
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

/**
 * SIMPSON (M4) — Метод Сімпсона (максимін).
 *
 * Для кожного критерію a:
 *   score(a) = min_{b ≠ a} P[a|b]
 *
 * Тобто беремо НАЙГІРШУ (мінімальну) попарну підтримку для кожного критерію.
 */
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

/**
 * Перетворення балів голосування у ваги [1..10] через min-max нормалізацію.
 *
 * t     = (score − minScore) / (maxScore − minScore)     — нормалізація в [0,1]
 * w     = 1 + t · 9                                        — масштабування в [1, 10]
 * w     = Math.round(clamp(w, 1, 10))                     — округлення до цілого
 */
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

/**
 * Вхідна точка — обчислення ваг критеріїв через голосування.
 *
 * @param {string}  method   — "plurality" | "borda" | "copeland" | "simpson"
 * @param {Array}   ballots  — [{ expertId, ranks: Map<criterionId, rank> }]
 * @param {Array}   experts  — [{ _id, competenceK }]
 * @param {string[]} criterionIds
 * @returns {{ ok, scores, weights, ranked }}
 */
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
