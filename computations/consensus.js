/**
 * Консенсус — методи узгодження експертних оцінок.
 *
 * Три методи (з підручника):
 *   E1 — Статистичний:           a = Σαᵢ·aᵢ, σ² = Σαᵢ·(a−aᵢ)²
 *   E2 — Статистичний (тріади):  aᵢ = (γ₁·opt + γ₂·real + γ₃·pess)/Σγ, σ² = внутрішня + зовнішня
 *   E7 — Алгебраїчний:           утилітарний (зважена медіана) та егалітарний (бінарний пошук t)
 */

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

/**
 * Ваги компетентності експертів: αᵢ = Kᵢ / ΣK.
 * Якщо сума K = 0 або mode="equal" → всі експерти рівні: αᵢ = 1/n.
 */
function computeAlphaWeights(experts, { mode = "competence" } = {}) {
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

/**
 * Зважена медіана — допоміжна для E7 Utilitarian.
 *
 * Алгоритм:
 * 1. Сортуємо пари (value, weight) за зростанням value.
 * 2. Накопичуємо вагу. Перше значення, де cum >= 0.5 — це медіана.
 *
 * Це розв'язок задачі: min Σ αᵢ·|a − aᵢ|
 */
function weightedMedian(pairs) {
  const sorted = [...pairs].sort((a, b) => a.value - b.value);
  let cum = 0;
  for (const p of sorted) {
    cum += p.weight;
    if (cum >= 0.5) return p.value;
  }
  return sorted.length ? sorted[sorted.length - 1].value : null;
}

/**
 * E7 УТИЛІТАРНИЙ — алгебраїчний метод.
 *
 * Критерій: мінімізуємо Σ αᵢ · |a − aᵢ|   (суму зважених абсолютних відхилень)
 * Розв'язок: зважена медіана (weightedMedian).
 *
 * Властивість: стійкий до викидів (екстремальні оцінки мало впливають).
 */
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

/**
 * E7 ЕГАЛІТАРНИЙ — алгебраїчний метод.
 *
 * Критерій: мінімізуємо max αᵢ · |a − aᵢ|   (максимальне зважене відхилення)
 *
 * Алгоритм через бінарний пошук:
 * - Шукаємо мінімальне t, при якому ВСІ інтервали [aᵢ − t/αᵢ, aᵢ + t/αᵢ] перетинаються.
 * - Відповідь a = середина спільного перетину.
 *
 * Властивість: жоден експерт не може бути "дуже далеко" від колективної думки.
 */
function e7Egalitarian({ valuesByExpertId, alphaByExpertId }) {
  const points = [];
  for (const [expertId, value] of valuesByExpertId.entries()) {
    const w = alphaByExpertId.get(expertId);
    if (!Number.isFinite(value) || !Number.isFinite(w) || w <= 0) continue;
    points.push({ expertId, value, w });
  }
  if (!points.length) {
    return { ok: false, error: "NO_VALUES" };
  }

  // Встановлюємо верхню межу для t:
  // при t = span · minW — напевно всі інтервали перетинаються
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

  // Перевіряє, чи існує спільний перетин інтервалів [aᵢ − t/αᵢ, aᵢ + t/αᵢ]
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

  // Якщо hi недостатньо — подвоюємо
  for (let i = 0; i < 30; i++) {
    const inter = intersectionForT(hi);
    if (inter.ok) break;
    hi *= 2;
  }

  // Бінарний пошук мінімального t (80 ітерацій для точності)
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
  const a = (left + right) / 2; // середина інтервалу — це відповідь
  return { ok: true, a, t: hi, interval: [left, right] };
}

/**
 * Коефіцієнти γ для психологічних типів експертів (E2).
 *
 *              γ₁ (opt)  γ₂ (real)  γ₃ (pess)  γ₄
 * Реаліст        1         4           1       36
 * Оптиміст       3         0           2       25
 * Песиміст       2         0           3       25
 *
 * aᵢ = (γ₁·opt + γ₂·real + γ₃·pess) / (γ₁+γ₂+γ₃)
 * σᵢ² = (pess − opt)² / γ₄
 */
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

/**
 * Обчислення індивідуальної оцінки експерта з тріади (E2).
 *
 * Формули:
 *   aᵢ    = (γ₁·opt + γ₂·real + γ₃·pess) / Σγ     — зважена середня
 *   σᵢ²   = (pess − opt)² / γ₄                     — внутрішня невизначеність
 */
function e2EstimateForExpert({ optimistic, realistic, pessimistic, psychType }) {
  const cfg = getPsychTypeConfig(psychType);
  const denom = cfg.gamma1 + cfg.gamma2 + cfg.gamma3;
  const ai = (cfg.gamma1 * optimistic + cfg.gamma2 * realistic + cfg.gamma3 * pessimistic) / denom;
  const spread = pessimistic - optimistic;
  const sigma2 = (spread * spread) / cfg.gamma4;
  return { ai, sigma2, cfg };
}

// Таблиця t-критерію Стьюдента (двостороннього) для довірчих інтервалів E2.
// Ключі: df → { p → t }, де p — ймовірність похибки.
// t(p, df) використовується в формулі: Δ = t·σ/√n
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

/**
 * E7 — Алгебраїчний метод, матричний варіант.
 *
 * Проходимо по всіх комірках (alternativeId, criterionId),
 * для кожної збираємо оцінки всіх експертів і обчислюємо узгоджене значення
 * через утилітарний або егалітарний критерій.
 */
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

/**
 * E1 — СТАТИСТИЧНИЙ МЕТОД.
 *
 * Експерти ізольовані, кожен дає ОДНУ числову оцінку.
 *
 * Формули:
 *   a     = Σ αᵢ · aᵢ              — зважене середнє (мат. сподівання)
 *   σ²    = Σ αᵢ · (a − aᵢ)²        — дисперсія (степінь неузгодженості)
 *   σ     = √σ²                     — середньоквадратичне відхилення
 *
 * Увага: ваги α всередині комірки нормалізуються так, щоб Σα = 1.
 */
function calculateE1Matrix({ experts, expertEvaluations }) {
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

    // Нормалізуємо ваги всередині комірки: α'_i = α_i / Σα
    const denom = sumAlpha > 0 ? sumAlpha : pairs.length;
    let a = 0;
    for (const p of pairs) {
      const w = sumAlpha > 0 ? p.alpha / denom : 1 / pairs.length;
      a += w * p.value;      // a = Σ wⱼ · valueⱼ
    }

    let sigma2 = 0;
    for (const p of pairs) {
      const w = sumAlpha > 0 ? p.alpha / denom : 1 / pairs.length;
      const d = a - p.value;
      sigma2 += w * d * d;   // σ² = Σ wⱼ · (a − valueⱼ)²
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

/**
 * E2 — СТАТИСТИЧНИЙ МЕТОД З ТРІАДАМИ.
 *
 * Кожен експерт дає ТРИ оцінки: оптимістичну, реалістичну, песимістичну.
 *
 * Крок 1 — індивідуальна оцінка експерта (e2EstimateForExpert):
 *   aᵢ    = (γ₁·opt + γ₂·real + γ₃·pess) / Σγ    — зважена за психотипом
 *   σᵢ²   = (pess − opt)² / γ₄                    — внутрішня невизначеність
 *
 * Крок 2 — агрегація:
 *   a     = Σ αᵢ · aᵢ                                          — узгоджена оцінка
 *   σ²    = Σ αᵢ · σᵢ²  +  Σ αᵢ · (a − aᵢ)²                   — загальна дисперсія
 *           \________/    \_______________/
 *           внутрішня      зовнішня (розбіжність)
 *
 * Крок 3 — довірчий інтервал (опціонально, через t-критерій Стьюдента):
 *   Δ = t(p, n−1) · σ / √n
 *   Інтервал: [a − Δ, a + Δ]
 */
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
      // Вимога: opt ≤ real ≤ pess (інакше тріада некоректна)
      if (!(optimistic <= realistic && realistic <= pessimistic)) {
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

    if (expertEstimates.length < 2) continue; // потрібно мінімум 2 експерти для коректної оцінки

    const n = expertEstimates.length;
    let a = 0;
    for (const e of expertEstimates) {
      a += e.alpha * e.ai;                   // a = Σ αᵢ · aᵢ
    }

    let sigma2 = 0;
    // Внутрішня дисперсія: Σ αᵢ · σᵢ² (невпевненість кожного експерта)
    for (const e of expertEstimates) {
      sigma2 += e.alpha * e.sigma2;
    }
    // Зовнішня дисперсія: Σ αᵢ · (a − aᵢ)² (розбіжність думок)
    for (const e of expertEstimates) {
      const d = a - e.ai;
      sigma2 += e.alpha * d * d;
    }

    const sigma = Math.sqrt(sigma2);

    // Довірчий інтервал: Δ = t·σ/√n
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
