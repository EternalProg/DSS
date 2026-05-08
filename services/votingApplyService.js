const criteriaRepo = require("../data/criteriaRepo");

async function applyWeightsToCriteria({ weightsByCriterionId }) {
  return criteriaRepo.bulkUpdateWeights({ weightsByCriterionId, source: "voting" });
}

module.exports = { applyWeightsToCriteria };
