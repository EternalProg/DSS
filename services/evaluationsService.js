const evaluationsRepo = require("../data/evaluationsRepo");
const { requireObjectId, requireFiniteNumber } = require("../validation/common");
const { notFound } = require("../utils/errors");

async function listEvaluations() {
  return evaluationsRepo.listAll();
}

async function upsertEvaluation({ alternativeId, criterionId, value }) {
  const altId = requireObjectId(alternativeId, "alternativeId");
  const critId = requireObjectId(criterionId, "criterionId");
  const v = requireFiniteNumber(value, "Value");

  const r = await evaluationsRepo.upsertByPair({
    alternativeId: altId,
    criterionId: critId,
    value: v
  });

  if (r.upsertedId) return { created: true, _id: r.upsertedId };
  return { created: false };
}

async function updateEvaluationById({ id, value }) {
  const _id = requireObjectId(id, "evaluation id");
  const v = requireFiniteNumber(value, "Value");
  const r = await evaluationsRepo.updateById(_id, { value: v });
  if (r.matchedCount === 0) throw notFound("Evaluation not found.");
  return { message: "Evaluation updated." };
}

module.exports = {
  listEvaluations,
  upsertEvaluation,
  updateEvaluationById
};
