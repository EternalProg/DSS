/**
 * Analytics Service - Decision Support System
 * Implements three aggregation strategies:
 * - Cautious (pessimistic): Q(Ai) = min(sj * wj * xij)
 * - Additive: Q(Ai) = sum(sj * wj * xij)
 * - Multiplicative: Q(Ai) = product(xij ^ (sj * wj))
 * where sj = +1 for maximize, sj = -1 for minimize.
 */

const allowedCriterionTypes = new Set(["maximize", "minimize"]);

// Bump when analytics math changes (helps detect stale server reloads).
const ANALYTICS_IMPL_VERSION = 3;

function getPairKey(alternativeId, criterionId) {
  return `${alternativeId.toString()}-${criterionId.toString()}`;
}

function buildEvaluationMap(evaluations) {
  const evaluationMap = new Map();

  evaluations.forEach((evaluation) => {
    evaluationMap.set(
      getPairKey(evaluation.alternativeId, evaluation.criterionId),
      evaluation
    );
  });

  return evaluationMap;
}

function getCriterionSign(criterionType) {
  return criterionType === "minimize" ? -1 : 1;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

function clampUnit(x, { eps = 1e-6 } = {}) {
  // For multiplicative we need strictly positive values.
  const n = Number(x);
  if (!Number.isFinite(n)) return eps;
  if (n <= eps) return eps;
  if (n >= 1) return 1;
  return n;
}

function getScaleModeFromEvaluations(evaluations) {
  // normalizeEvaluations() produces values clamped to (0..1].
  // We keep this detection internal to avoid threading extra params through all callers.
  let min = Infinity;
  let max = -Infinity;
  let seen = 0;
  for (const ev of evaluations) {
    const v = Number(ev?.value);
    if (!Number.isFinite(v)) continue;
    seen += 1;
    if (v < min) min = v;
    if (v > max) max = v;
    if (seen >= 50) break; // quick heuristic
  }
  if (!seen) return "raw";
  if (min >= 0 && max <= 1) return "normalized";
  return "raw";
}

function buildWeights({ criteria, scaleMode }) {
  // In normalized mode we normalize weights so final Q(Ai) stays within 0..1.
  const weights = new Map(); // criterionId -> w
  if (scaleMode !== "normalized") {
    for (const c of criteria) weights.set(String(c._id), Number(c.weight));
    return weights;
  }

  let sum = 0;
  for (const c of criteria) {
    const w = Number(c.weight);
    if (Number.isFinite(w) && w > 0) sum += w;
  }
  const denom = sum > 0 ? sum : 1;
  for (const c of criteria) {
    const w = Number(c.weight);
    const safe = Number.isFinite(w) && w > 0 ? w : 0;
    weights.set(String(c._id), safe / denom);
  }
  return weights;
}

function compareNumber(left, operator, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  switch (operator) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      return false;
  }
}

function applyRulesAndThresholds({ alternatives, criteria, evaluations, rules = [] }) {
  // Rules can exclude alternatives or adjust evaluation values.
  // Thresholds are stored on criteria: thresholdEnabled + thresholdValue.
  const evaluationMap = buildEvaluationMap(evaluations);

  const enabledRules = Array.isArray(rules) ? rules.filter((r) => r && r.enabled !== false) : [];
  const excludedByRule = new Map(); // altId -> reasons[]
  const adjusted = []; // { alternativeId, criterionId, from, to, ruleId }

  // Apply rule actions.
  for (const alt of alternatives) {
    const altId = alt._id;

    for (const rule of enabledRules) {
      const when = rule.when || {};
      const then = rule.then || {};
      const keyWhen = when.criterionId ? getPairKey(altId, when.criterionId) : null;
      const evWhen = keyWhen ? evaluationMap.get(keyWhen) : null;
      const left = evWhen ? Number(evWhen.value) : NaN;
      const right = Number(when.value);
      const op = String(when.operator || "").trim();
      if (!compareNumber(left, op, right)) continue;

      if (then.action === "exclude") {
        if (!excludedByRule.has(String(altId))) excludedByRule.set(String(altId), []);
        excludedByRule
          .get(String(altId))
          .push({ ruleId: rule._id, criterionId: when.criterionId, operator: op, value: right });
        // Keep applying other rules for diagnostics, but exclusion is final.
        continue;
      }

      if (then.action === "adjust_percent") {
        const pct = Number(then.percent);
        if (!Number.isFinite(pct)) continue;
        const targetCriterionId = then.targetCriterionId || when.criterionId;
        if (!targetCriterionId) continue;
        const keyTarget = getPairKey(altId, targetCriterionId);
        const evTarget = evaluationMap.get(keyTarget);
        if (!evTarget) continue;
        const from = Number(evTarget.value);
        if (!Number.isFinite(from)) continue;
        const factor = 1 + pct / 100;
        const to = from * factor;
        evTarget.value = to;
        adjusted.push({
          alternativeId: altId,
          criterionId: targetCriterionId,
          from,
          to,
          ruleId: rule._id,
          percent: pct
        });
      }
    }
  }

  // Apply thresholds after rule adjustments.
  const excludedByThreshold = new Map(); // altId -> reasons[]
  for (const alt of alternatives) {
    const altId = alt._id;
    for (const c of criteria) {
      if (!c.thresholdEnabled) continue;
      const t = Number(c.thresholdValue);
      if (!Number.isFinite(t)) continue;
      const ev = evaluationMap.get(getPairKey(altId, c._id));
      const v = ev ? Number(ev.value) : NaN;
      if (!Number.isFinite(v)) {
        if (!excludedByThreshold.has(String(altId))) excludedByThreshold.set(String(altId), []);
        excludedByThreshold.get(String(altId)).push({ criterionId: c._id, reason: "MISSING" });
        continue;
      }
      const ok = c.type === "minimize" ? v <= t : v >= t;
      if (!ok) {
        if (!excludedByThreshold.has(String(altId))) excludedByThreshold.set(String(altId), []);
        excludedByThreshold.get(String(altId)).push({
          criterionId: c._id,
          threshold: t,
          value: v
        });
      }
    }
  }

  const excludedAltIds = new Set([
    ...excludedByRule.keys(),
    ...excludedByThreshold.keys()
  ]);

  const filteredAlternatives = alternatives.filter((a) => !excludedAltIds.has(String(a._id)));
  const filteredEvaluations = [];
  for (const ev of evaluationMap.values()) {
    // evaluationMap includes adjusted ev objects; keep only those for included alternatives.
    if (!excludedAltIds.has(String(ev.alternativeId))) filteredEvaluations.push(ev);
  }

  return {
    alternatives: filteredAlternatives,
    evaluations: filteredEvaluations,
    meta: {
      excludedByRule: Object.fromEntries(excludedByRule.entries()),
      excludedByThreshold: Object.fromEntries(excludedByThreshold.entries()),
      adjusted
    }
  };
}

function normalizeEvaluations({ alternatives, criteria, evaluations, mode = "raw" }) {
  const m = String(mode || "raw").trim().toLowerCase();
  if (m !== "normalized") return { evaluations, meta: { scaleMode: "raw" } };

  const byCrit = new Map();
  for (const ev of evaluations) {
    const cid = String(ev.criterionId);
    const v = Number(ev.value);
    if (!Number.isFinite(v)) continue;
    if (!byCrit.has(cid)) byCrit.set(cid, []);
    byCrit.get(cid).push(v);
  }

  const critById = new Map(criteria.map((c) => [String(c._id), c]));
  const ranges = new Map();
  for (const [cid, vals] of byCrit.entries()) {
    let min = Infinity;
    let max = -Infinity;
    for (const v of vals) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    ranges.set(cid, { min, max });
  }

  const normalized = evaluations.map((ev) => {
    const cid = String(ev.criterionId);
    const c = critById.get(cid);
    const r = ranges.get(cid);
    const v = Number(ev.value);
    if (!Number.isFinite(v) || !r || !Number.isFinite(r.min) || !Number.isFinite(r.max)) return ev;
    const span = r.max - r.min;
    if (span === 0) {
      return { ...ev, value: 1 };
    }
    const raw01 = (v - r.min) / span;
    const val01 = c?.type === "minimize" ? 1 - raw01 : raw01;
    // Keep within 0..1, but avoid exact 0/1 which collapses cautious strategy
    // and makes multiplicative underflow too easily.
    const eps = 1e-3;
    const clamped = clamp01(val01);
    const safe01 = clamped * (1 - 2 * eps) + eps;
    return { ...ev, value: safe01 };
  });

  return { evaluations: normalized, meta: { scaleMode: "normalized" } };
}

function validateAnalysisData(
  alternatives,
  criteria,
  evaluations,
  strategies = ["cautious", "additive", "multiplicative"]
) {
  const errors = [];
  const evaluationMap = buildEvaluationMap(evaluations);
  const requiresPositiveValues = strategies.includes("multiplicative");

  for (const criterion of criteria) {
    if (!allowedCriterionTypes.has(criterion.type)) {
      errors.push(
        `Критерій "${criterion.name}" має некоректний тип. Дозволено: maximize або minimize.`
      );
    }

    const weight = Number(criterion.weight);
    if (!Number.isFinite(weight) || weight < 1 || weight > 10) {
      errors.push(
        `Не задано коректну вагу (1-10) для критерію "${criterion.name}".`
      );
    }
  }

  for (const alternative of alternatives) {
    for (const criterion of criteria) {
      const evaluation = evaluationMap.get(
        getPairKey(alternative._id, criterion._id)
      );

      if (!evaluation) {
        errors.push(
          `Відсутня оцінка для альтернативи "${alternative.name}" за критерієм "${criterion.name}".`
        );
        continue;
      }

      const value = Number(evaluation.value);

      if (!Number.isFinite(value)) {
        errors.push(
          `Некоректне значення оцінки для альтернативи "${alternative.name}" за критерієм "${criterion.name}".`
        );
        continue;
      }

      if (requiresPositiveValues && value <= 0) {
        errors.push(
          `Для мультиплікативної стратегії значення має бути > 0: альтернатива "${alternative.name}", критерій "${criterion.name}".`
        );
      }
    }
  }

  return errors;
}

/**
 * Cautious strategy - takes minimum signed weighted score
 * Q(Ai) = min(sj * wj * xij)
 */
function calculateCautious(
  alternatives,
  criteria,
  evaluations,
  context = { evaluationMap: buildEvaluationMap(evaluations) }
) {
  const results = [];

  const scaleMode = context?.scaleMode || getScaleModeFromEvaluations(evaluations);
  const wByCritId = buildWeights({ criteria, scaleMode });
  const useWeights = scaleMode !== "normalized"; // In normalized mode use pure maximin in 0..1.

  for (const alternative of alternatives) {
    let minScore = Infinity;
    const details = [];

    for (const criterion of criteria) {
      const evaluation = context.evaluationMap.get(
        getPairKey(alternative._id, criterion._id)
      );

      if (!evaluation) continue;

      const weight = useWeights
        ? (wByCritId.get(String(criterion._id)) ?? Number(criterion.weight))
        : 1;
      const value = Number(evaluation.value);
      const sign = scaleMode === "normalized" ? 1 : getCriterionSign(criterion.type);
      const score = sign * weight * value;

      details.push({
        criterionId: criterion._id,
        criterionName: criterion.name,
        criterionType: criterion.type,
        weight,
        sign,
        value,
        score
      });

      if (score < minScore) {
        minScore = score;
      }
    }

    results.push({
      alternativeId: alternative._id,
      alternativeName: alternative.name,
      score:
        minScore === Infinity
          ? 0
          : scaleMode === "normalized"
            ? clamp01(minScore)
            : minScore,
      details
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Additive strategy - sum of signed weighted scores
 * Q(Ai) = sum(sj * wj * xij)
 */
function calculateAdditive(
  alternatives,
  criteria,
  evaluations,
  context = { evaluationMap: buildEvaluationMap(evaluations) }
) {
  const results = [];

  const scaleMode = context?.scaleMode || getScaleModeFromEvaluations(evaluations);
  const wByCritId = buildWeights({ criteria, scaleMode });

  for (const alternative of alternatives) {
    let totalScore = 0;
    const details = [];

    for (const criterion of criteria) {
      const evaluation = context.evaluationMap.get(
        getPairKey(alternative._id, criterion._id)
      );

      if (!evaluation) continue;

      const weight = wByCritId.get(String(criterion._id)) ?? Number(criterion.weight);
      const value = Number(evaluation.value);
      const sign = scaleMode === "normalized" ? 1 : getCriterionSign(criterion.type);
      const score = sign * weight * value;

      details.push({
        criterionId: criterion._id,
        criterionName: criterion.name,
        criterionType: criterion.type,
        weight,
        sign,
        value,
        score
      });

      totalScore += score;
    }

    results.push({
      alternativeId: alternative._id,
      alternativeName: alternative.name,
      score: scaleMode === "normalized" ? clamp01(totalScore) : totalScore,
      details
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Multiplicative strategy with signed exponent
 * Q(Ai) = product(xij ^ (sj * wj))
 */
function calculateMultiplicative(
  alternatives,
  criteria,
  evaluations,
  context = { evaluationMap: buildEvaluationMap(evaluations) }
) {
  const results = [];

  const scaleMode = context?.scaleMode || getScaleModeFromEvaluations(evaluations);
  const wByCritId = buildWeights({ criteria, scaleMode });
  const eps = 1e-6;

  for (const alternative of alternatives) {
    let product = 1;
    const details = [];
    let hasEvaluations = false;

    for (const criterion of criteria) {
      const evaluation = context.evaluationMap.get(
        getPairKey(alternative._id, criterion._id)
      );

      if (!evaluation) continue;

      hasEvaluations = true;
      const weight = wByCritId.get(String(criterion._id)) ?? Number(criterion.weight);
      const value = scaleMode === "normalized"
        ? clampUnit(evaluation.value, { eps })
        : Number(evaluation.value);
      const sign = scaleMode === "normalized" ? 1 : getCriterionSign(criterion.type);
      const exponent = sign * weight;
      const partialScore = Math.pow(value, exponent);

      details.push({
        criterionId: criterion._id,
        criterionName: criterion.name,
        criterionType: criterion.type,
        weight,
        sign,
        exponent,
        value,
        score: partialScore
      });

      product *= partialScore;
    }

    results.push({
      alternativeId: alternative._id,
      alternativeName: alternative.name,
      score: hasEvaluations ? (scaleMode === "normalized" ? clamp01(product) : product) : 0,
      details
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Generate explanation for the results
 */
function generateExplanation(results, strategyName, strategyId) {
  if (!results.length) {
    return "Недостатньо даних для аналізу.";
  }

  const winner = results[0];
  const runnerUp = results[1];

  let explanation = `За ${strategyName} стратегією переможець: ${winner.alternativeName} (${winner.score.toFixed(2)})\n\n`;

  explanation += "Найбільший вплив на результат:\n";

  const sortedDetails = [...winner.details].sort((a, b) => b.score - a.score);
  const topCriteria = sortedDetails.slice(0, 3);

  for (const detail of topCriteria) {
    if (strategyId === "multiplicative") {
      explanation += `  - "${detail.criterionName}" (${detail.criterionType}): x=${detail.value}, експонента ${detail.exponent} => множник ${detail.score.toFixed(4)}\n`;
      continue;
    }

    const signPrefix = detail.sign === -1 ? "-" : "+";
    explanation += `  - "${detail.criterionName}" (${detail.criterionType}): ${signPrefix}${detail.weight} * ${detail.value} = ${detail.score.toFixed(2)}\n`;
  }

  if (runnerUp) {
    const diff = winner.score - runnerUp.score;
    explanation += `\nДругий варіант: ${runnerUp.alternativeName} (${runnerUp.score.toFixed(2)})`;
    explanation += `\nРізниця: ${diff.toFixed(2)} балів`;
  }

  return explanation;
}

/**
 * Main analysis function
 */
function analyze(
  alternatives,
  criteria,
  evaluations,
  strategies = ["cautious", "additive", "multiplicative"],
  options = {}
) {
  const results = {};
  const context = {
    evaluationMap: buildEvaluationMap(evaluations),
    scaleMode: options?.scaleMode || getScaleModeFromEvaluations(evaluations)
  };

  const isNormalized = context.scaleMode === "normalized";

  if (strategies.includes("cautious")) {
    results.cautious = {
      name: "Обережна",
      formula: "Q(Ai) = min(sj * wj * xij)",
      description: isNormalized
        ? "Нормалізований режим: для minimize значення інвертуються в 0..1, після чого береться мінімум зважених внесків (без від'ємних знаків)."
        : "Мінімум зі знакових зважених оцінок (sj=+1 для maximize, sj=-1 для minimize).",
      results: calculateCautious(alternatives, criteria, evaluations, context)
    };
    results.cautious.explanation = generateExplanation(
      results.cautious.results,
      "обережною",
      "cautious"
    );
  }

  if (strategies.includes("additive")) {
    results.additive = {
      name: "Адитивна",
      formula: "Q(Ai) = sum(sj * wj * xij)",
      description: isNormalized
        ? "Нормалізований режим: для minimize значення інвертуються в 0..1, ваги нормалізуються (Σw=1), далі рахується зважена сума у межах 0..1."
        : "Сума знакових зважених оцінок (для minimize внесок віднімається).",
      results: calculateAdditive(alternatives, criteria, evaluations, context)
    };
    results.additive.explanation = generateExplanation(
      results.additive.results,
      "адитивною",
      "additive"
    );
  }

  if (strategies.includes("multiplicative")) {
    results.multiplicative = {
      name: "Мультиплікативна",
      formula: "Q(Ai) = product(xij^(sj * wj))",
      description: isNormalized
        ? "Нормалізований режим: для minimize значення інвертуються в 0..1, ваги нормалізуються (Σw=1), добуток рахується з додатними експонентами, результат у межах 0..1."
        : "Добуток зі знаковою експонентою: для minimize використовується від'ємний показник степеня.",
      results: calculateMultiplicative(alternatives, criteria, evaluations, context)
    };
    results.multiplicative.explanation = generateExplanation(
      results.multiplicative.results,
      "мультиплікативною",
      "multiplicative"
    );
  }

  const recommendedStrategy =
    results.additive || results.cautious || results.multiplicative;
  const winner = recommendedStrategy?.results[0] || null;

  return {
    meta: {
      analyticsImplVersion: ANALYTICS_IMPL_VERSION,
      scaleMode: context.scaleMode
    },
    strategies: results,
    recommendation: {
      winner: winner
        ? {
            alternativeId: winner.alternativeId,
            alternativeName: winner.alternativeName,
            score: winner.score
          }
        : null,
      strategy: "additive",
      reason: isNormalized
        ? "Адитивна стратегія є найпоширенішою. У нормалізованому режимі: minimize інвертується в 0..1, ваги нормалізуються (Σw=1), далі рахується зважена сума в межах 0..1."
        : "Адитивна стратегія є найпоширенішою: критерії maximize додаються, а minimize - віднімаються"
      
    }
  };
}

module.exports = {
  ANALYTICS_IMPL_VERSION,
  validateAnalysisData,
  applyRulesAndThresholds,
  normalizeEvaluations,
  calculateCautious,
  calculateAdditive,
  calculateMultiplicative,
  generateExplanation,
  analyze
};
