const alternativesRepo = require("../data/alternativesRepo");
const evaluationsRepo = require("../data/evaluationsRepo");
const { requireNonEmptyString, optionalString, requireObjectId } = require("../validation/common");
const { conflict, notFound, isMongoDuplicateKeyError } = require("../utils/errors");

async function listAlternatives() {
  return alternativesRepo.listAll();
}

async function createAlternative({ name, description }) {
  const n = requireNonEmptyString(name, "Name");
  const d = optionalString(description);

  try {
    return await alternativesRepo.insertOne({ name: n, description: d });
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw conflict("Alternative name already exists.");
    }
    throw error;
  }
}

async function updateAlternative({ id, name, description }) {
  const _id = requireObjectId(id, "alternative id");
  const n = requireNonEmptyString(name, "Name");
  const d = optionalString(description);

  try {
    const r = await alternativesRepo.updateById(_id, { name: n, description: d });
    if (r.matchedCount === 0) throw notFound("Alternative not found.");
    return { message: "Alternative updated." };
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw conflict("Alternative name already exists.");
    }
    throw error;
  }
}

async function deleteAlternative({ id }) {
  const _id = requireObjectId(id, "alternative id");
  const r = await alternativesRepo.deleteById(_id);
  if (r.deletedCount === 0) throw notFound("Alternative not found.");
  await evaluationsRepo.deleteByAlternativeId(_id);
  return { message: "Alternative deleted." };
}

module.exports = {
  listAlternatives,
  createAlternative,
  updateAlternative,
  deleteAlternative
};
