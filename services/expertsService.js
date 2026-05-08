const expertsRepo = require("../data/expertsRepo");
const { requireObjectId, requireFiniteNumber } = require("../validation/common");
const { badRequest, notFound } = require("../utils/errors");
const { getPsychTypeConfig } = require("../computations/consensus");

async function listExperts() {
  return expertsRepo.listAll();
}

async function updateExpert({ id, competenceK, psychType, hasCompetenceKField = false, hasPsychTypeField = false }) {
  const _id = requireObjectId(id, "expert id");

  const updates = {};
  if (hasCompetenceKField) {
    const k = requireFiniteNumber(competenceK, "competenceK");
    if (k <= 0 || k > 1e9) throw badRequest("competenceK must be a positive number.");
    updates.competenceK = k;
  }

  if (hasPsychTypeField) {
    const raw = String(psychType ?? "").trim().toLowerCase();
    const allowed = ["realist", "optimist", "pessimist"];
    if (!allowed.includes(raw)) {
      throw badRequest("psychType must be one of: realist, optimist, pessimist.");
    }
    getPsychTypeConfig(raw);
    updates.psychType = raw;
  }

  if (!Object.keys(updates).length) throw badRequest("No fields to update.");
  updates.updatedAt = new Date();

  const r = await expertsRepo.updateById(_id, updates);
  if (r.matchedCount === 0) throw notFound("Expert not found.");
  return { message: "Expert updated." };
}

module.exports = {
  listExperts,
  updateExpert
};
