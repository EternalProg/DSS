const { requireObjectId, requireFiniteNumber } = require("../validation/common");
const { badRequest } = require("../utils/errors");
const expertTriadsRepo = require("../data/expertTriadsRepo");

async function listTriads() {
  return expertTriadsRepo.listAll();
}

async function saveTriad({ expertId, alternativeId, criterionId, optimistic, realistic, pessimistic }) {
  const eId = requireObjectId(expertId, "expertId");
  const aId = requireObjectId(alternativeId, "alternativeId");
  const cId = requireObjectId(criterionId, "criterionId");

  const o = requireFiniteNumber(optimistic, "optimistic");
  const r = requireFiniteNumber(realistic, "realistic");
  const p = requireFiniteNumber(pessimistic, "pessimistic");
  if (!(o <= r && r <= p)) {
    throw badRequest("Must satisfy optimistic <= realistic <= pessimistic.");
  }

  const now = new Date();
  const result = await expertTriadsRepo.upsertOne({
    expertId: eId,
    alternativeId: aId,
    criterionId: cId,
    optimistic: o,
    realistic: r,
    pessimistic: p,
    now
  });

  if (result.upsertedId) return { created: true, _id: result.upsertedId };
  return { created: false };
}

module.exports = {
  listTriads,
  saveTriad
};
