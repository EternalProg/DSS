const { ObjectId } = require("mongodb");
const { badRequest } = require("../utils/errors");

function requireNonEmptyString(value, fieldName) {
  const s = String(value ?? "").trim();
  if (!s) throw badRequest(`${fieldName} is required.`);
  return s;
}

function optionalString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function requireEnum(value, fieldName, allowed) {
  const v = String(value ?? "").trim();
  if (!allowed.includes(v)) {
    throw badRequest(`${fieldName} must be one of: ${allowed.join(", ")}.`);
  }
  return v;
}

function requireObjectId(value, fieldName) {
  if (!ObjectId.isValid(value)) {
    throw badRequest(`Valid ${fieldName} is required.`);
  }
  return new ObjectId(value);
}

function requireFiniteNumber(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest(`${fieldName} must be a number.`);
  return n;
}

function optionalFiniteNumber(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest("Value must be a number.");
  return n;
}

module.exports = {
  requireNonEmptyString,
  optionalString,
  requireEnum,
  requireObjectId,
  requireFiniteNumber,
  optionalFiniteNumber
};
