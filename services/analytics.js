/**
 * Analytics Service - Decision Support System
 * Implements three aggregation strategies:
 * - Cautious (pessimistic): Q(Ai) = min(wj * xij)
 * - Additive: Q(Ai) = sum(wj * xij)
 * - Multiplicative: Q(Ai) = product(xij ^ wj)
 */

/**
 * Cautious strategy - takes minimum weighted score
 * Q(Ai) = min(wj * xij)
 */
function calculateCautious(alternatives, criteria, evaluations) {
  const results = [];

  for (const alt of alternatives) {
    let minScore = Infinity;
    const details = [];

    for (const crit of criteria) {
      const evaluation = evaluations.find(
        (e) =>
          e.alternativeId.toString() === alt._id.toString() &&
          e.criterionId.toString() === crit._id.toString()
      );

      if (!evaluation) continue;

      const weight = crit.weight || 5;
      const value = evaluation.value;
      const score = weight * value;

      details.push({
        criterionId: crit._id,
        criterionName: crit.name,
        weight,
        value,
        score
      });

      if (score < minScore) {
        minScore = score;
      }
    }

    results.push({
      alternativeId: alt._id,
      alternativeName: alt.name,
      score: minScore === Infinity ? 0 : minScore,
      details
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Additive strategy - sum of weighted scores
 * Q(Ai) = sum(wj * xij)
 */
function calculateAdditive(alternatives, criteria, evaluations) {
  const results = [];

  for (const alt of alternatives) {
    let totalScore = 0;
    const details = [];

    for (const crit of criteria) {
      const evaluation = evaluations.find(
        (e) =>
          e.alternativeId.toString() === alt._id.toString() &&
          e.criterionId.toString() === crit._id.toString()
      );

      if (!evaluation) continue;

      const weight = crit.weight || 5;
      const value = evaluation.value;
      const score = weight * value;

      details.push({
        criterionId: crit._id,
        criterionName: crit.name,
        weight,
        value,
        score
      });

      totalScore += score;
    }

    results.push({
      alternativeId: alt._id,
      alternativeName: alt.name,
      score: totalScore,
      details
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Multiplicative strategy - product of values raised to weight power
 * Q(Ai) = product(xij ^ wj)
 */
function calculateMultiplicative(alternatives, criteria, evaluations) {
  const results = [];

  for (const alt of alternatives) {
    let product = 1;
    const details = [];
    let hasEvaluations = false;

    for (const crit of criteria) {
      const evaluation = evaluations.find(
        (e) =>
          e.alternativeId.toString() === alt._id.toString() &&
          e.criterionId.toString() === crit._id.toString()
      );

      if (!evaluation) continue;

      hasEvaluations = true;
      const weight = crit.weight || 5;
      const value = evaluation.value;
      const partialScore = Math.pow(value, weight);

      details.push({
        criterionId: crit._id,
        criterionName: crit.name,
        weight,
        value,
        score: partialScore
      });

      product *= partialScore;
    }

    results.push({
      alternativeId: alt._id,
      alternativeName: alt.name,
      score: hasEvaluations ? product : 0,
      details
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Generate explanation for the results
 */
function generateExplanation(results, strategyName, criteria) {
  if (!results.length) {
    return "Недостатньо даних для аналізу.";
  }

  const winner = results[0];
  const runnerUp = results[1];

  let explanation = `За ${strategyName} стратегією переможець: ${winner.alternativeName} (${winner.score.toFixed(2)})\n\n`;

  explanation += "Чому саме ця альтернатива?\n";

  const sortedDetails = [...winner.details].sort((a, b) => b.score - a.score);
  const topCriteria = sortedDetails.slice(0, 3);

  for (const detail of topCriteria) {
    explanation += `  - Висока оцінка за критерієм "${detail.criterionName}": ${detail.value}/10 (вага: ${detail.weight})\n`;
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
function analyze(alternatives, criteria, evaluations, strategies = ["cautious", "additive", "multiplicative"]) {
  const results = {};

  if (strategies.includes("cautious")) {
    results.cautious = {
      name: "Обережна",
      formula: "Q(Ai) = min(wj * xij)",
      description: "Оцінка за найгіршим критерієм. Підходить для критичних систем.",
      results: calculateCautious(alternatives, criteria, evaluations)
    };
    results.cautious.explanation = generateExplanation(
      results.cautious.results,
      "обережною",
      criteria
    );
  }

  if (strategies.includes("additive")) {
    results.additive = {
      name: "Адитивна",
      formula: "Q(Ai) = \u03a3(wj * xij)",
      description: "Сума зважених оцінок. Критерії компенсують один одного.",
      results: calculateAdditive(alternatives, criteria, evaluations)
    };
    results.additive.explanation = generateExplanation(
      results.additive.results,
      "адитивною",
      criteria
    );
  }

  if (strategies.includes("multiplicative")) {
    results.multiplicative = {
      name: "Мультиплікативна",
      formula: "Q(Ai) = \u03a0(xij^wj)",
      description: "Добуток оцінок у степені ваг. Слабкі значення сильніше впливають.",
      results: calculateMultiplicative(alternatives, criteria, evaluations)
    };
    results.multiplicative.explanation = generateExplanation(
      results.multiplicative.results,
      "мультиплікативною",
      criteria
    );
  }

  // Determine overall winner (by additive as default recommendation)
  const recommendedStrategy = results.additive || results.cautious || results.multiplicative;
  const winner = recommendedStrategy?.results[0] || null;

  return {
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
      reason: "Адитивна стратегія є найпоширенішою і дозволяє критеріям компенсувати один одного."
    }
  };
}

module.exports = {
  calculateCautious,
  calculateAdditive,
  calculateMultiplicative,
  generateExplanation,
  analyze
};
