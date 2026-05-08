const criteriaRepo = require("../data/criteriaRepo");
const evaluationsRepo = require("../data/evaluationsRepo");
const {
  requireNonEmptyString,
  optionalString,
  requireEnum,
  requireObjectId,
  requireFiniteNumber,
  optionalFiniteNumber
} = require("../validation/common");
const { conflict, notFound, badRequest, isMongoDuplicateKeyError } = require("../utils/errors");

const allowedTypes = ["maximize", "minimize"];

function normalizeCriterionCode(code) {
  const normalized = code != null && String(code).trim() ? String(code).trim().toUpperCase() : null;
  if (normalized && !/^C\d+$/.test(normalized)) {
    throw badRequest("Code повинен мати вигляд C<number> (наприклад, C1).");
  }
  return normalized;
}

async function listCriteria() {
  return criteriaRepo.listAll();
}

async function createCriterion({ name, type, description, code }) {
  const n = requireNonEmptyString(name, "Name");
  const t = requireEnum(type, "Type", allowedTypes);
  const d = optionalString(description);
  const c = normalizeCriterionCode(code);

  const doc = {
    name: n,
    type: t,
    ...(c ? { code: c } : {}),
    description: d,
    createdAt: new Date()
  };

  try {
    return await criteriaRepo.insertOne(doc);
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw conflict("Criterion name already exists.");
    }
    throw error;
  }
}

async function updateCriterion({ id, name, type, description, code, hasCodeField }) {
  const _id = requireObjectId(id, "criterion id");
  const n = requireNonEmptyString(name, "Name");
  const t = requireEnum(type, "Type", allowedTypes);
  const d = optionalString(description);
  const c = hasCodeField ? normalizeCriterionCode(code) : null;

  const setDoc = {
    name: n,
    type: t,
    description: d,
    updatedAt: new Date()
  };

  const updateDoc = { $set: setDoc };
  if (hasCodeField) {
    if (c) updateDoc.$set.code = c;
    else updateDoc.$unset = { code: "" };
  }

  try {
    const r = await criteriaRepo.updateById(_id, updateDoc);
    if (r.matchedCount === 0) throw notFound("Criterion not found.");
    return { message: "Criterion updated." };
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw conflict("Criterion name already exists.");
    }
    throw error;
  }
}

async function updateCriterionWeight({ id, weight }) {
  const _id = requireObjectId(id, "criterion id");
  const w = requireFiniteNumber(weight, "Weight");
  if (!Number.isInteger(w) || w < 1 || w > 10) {
    throw badRequest("Weight must be a number from 1 to 10.");
  }

  const r = await criteriaRepo.updateById(_id, {
    $set: { weight: w, updatedAt: new Date() }
  });
  if (r.matchedCount === 0) throw notFound("Criterion not found.");
  return { message: "Weight updated." };
}

async function updateCriterionThreshold({ id, enabled, value, note }) {
  const _id = requireObjectId(id, "criterion id");
  const isEnabled = Boolean(enabled);
  const numericValue = optionalFiniteNumber(value);
  const thresholdNote = typeof note === "string" ? note.trim() : undefined;

  const update = {
    $set: {
      thresholdEnabled: isEnabled,
      ...(isEnabled && numericValue != null ? { thresholdValue: numericValue } : {}),
      ...(thresholdNote !== undefined ? { thresholdNote } : {}),
      updatedAt: new Date()
    }
  };
  if (!isEnabled || (isEnabled && numericValue == null)) {
    update.$unset = { thresholdValue: "" };
  }

  const r = await criteriaRepo.updateById(_id, update);
  if (r.matchedCount === 0) throw notFound("Criterion not found.");
  return { message: "Threshold updated." };
}

async function deleteCriterion({ id }) {
  const _id = requireObjectId(id, "criterion id");
  const r = await criteriaRepo.deleteById(_id);
  if (r.deletedCount === 0) throw notFound("Criterion not found.");
  await evaluationsRepo.deleteByCriterionId(_id);
  return { message: "Criterion deleted." };
}

module.exports = {
  allowedTypes,
  listCriteria,
  createCriterion,
  updateCriterion,
  updateCriterionWeight,
  updateCriterionThreshold,
  deleteCriterion
};
