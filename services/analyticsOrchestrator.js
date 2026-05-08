const analytics = require("../computations/analytics");
const alternativesRepo = require("../data/alternativesRepo");
const criteriaRepo = require("../data/criteriaRepo");
const evaluationsRepo = require("../data/evaluationsRepo");
const rulesRepo = require("../data/rulesRepo");
const { badRequest } = require("../utils/errors");

async function calculate({ strategies, scaleMode } = {}) {
  const selectedStrategies = Array.isArray(strategies) && strategies.length
    ? strategies
    : ["cautious", "additive", "multiplicative"];

  const [alternatives, criteria, evaluations, rules] = await Promise.all([
    alternativesRepo.listAll(),
    criteriaRepo.listAll(),
    evaluationsRepo.listAll(),
    rulesRepo.listAll()
  ]);

  if (!alternatives.length) throw badRequest("Не знайдено жодної альтернативи.");
  if (!criteria.length) throw badRequest("Не знайдено жодного критерію.");
  if (!evaluations.length) throw badRequest("Не знайдено жодної оцінки.");

  const prepared = analytics.applyRulesAndThresholds({
    alternatives,
    criteria,
    evaluations,
    rules
  });

  const scaled = analytics.normalizeEvaluations({
    alternatives: prepared.alternatives,
    criteria,
    evaluations: prepared.evaluations,
    mode: scaleMode
  });

  if (!prepared.alternatives.length) {
    throw badRequest(
      "Після застосування порогів/правил не залишилося допустимих альтернатив. Послабте пороги або вимкніть правила."
    );
  }

  const validationErrors = analytics.validateAnalysisData(
    prepared.alternatives,
    criteria,
    scaled.evaluations,
    selectedStrategies
  );
  if (validationErrors.length) {
    const visibleErrors = validationErrors.slice(0, 3).join(" ");
    const hiddenCount = validationErrors.length - 3;
    const hiddenSuffix = hiddenCount > 0 ? ` (і ще ${hiddenCount} помилок).` : "";
    throw badRequest(`Неможливо виконати розрахунок. ${visibleErrors}${hiddenSuffix}`);
  }

  const result = analytics.analyze(
    prepared.alternatives,
    criteria,
    scaled.evaluations,
    selectedStrategies,
    { scaleMode: scaled.meta.scaleMode }
  );

  result.logic = prepared.meta;
  result.logic.scaleMode = scaled.meta.scaleMode;
  result.counts = {
    before: { alternatives: alternatives.length, evaluations: evaluations.length, rules: rules.length },
    after: { alternatives: prepared.alternatives.length, evaluations: prepared.evaluations.length }
  };

  return result;
}

module.exports = { calculate };
