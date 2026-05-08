const { ObjectId } = require("mongodb");
const rulesRepo = require("../data/rulesRepo");
const { requireObjectId, requireFiniteNumber } = require("../validation/common");
const { badRequest, notFound } = require("../utils/errors");

const allowedOperators = new Set([">", ">=", "<", "<=", "==", "!="]);
const allowedActions = new Set(["exclude", "adjust_percent"]);

function normalizeOperator(op) {
  const x = String(op ?? "").trim();
  return allowedOperators.has(x) ? x : null;
}

function normalizeAction(action) {
  const x = String(action ?? "").trim();
  return allowedActions.has(x) ? x : null;
}

async function listRules() {
  return rulesRepo.listAll();
}

async function createRule(payload) {
  const {
    enabled = true,
    criterionId,
    operator,
    value,
    action,
    percent,
    targetCriterionId,
    note
  } = payload ?? {};

  const cid = requireObjectId(criterionId, "criterionId");
  const op = normalizeOperator(operator);
  if (!op) throw badRequest("Invalid operator.");
  const v = requireFiniteNumber(value, "Value");

  const act = normalizeAction(action);
  if (!act) throw badRequest("Invalid action.");

  const doc = {
    enabled: Boolean(enabled),
    when: { criterionId: cid, operator: op, value: v },
    then: { action: act },
    note: typeof note === "string" ? note.trim() : "",
    createdAt: new Date()
  };

  if (act === "adjust_percent") {
    const p = requireFiniteNumber(percent, "Percent");
    const targetId =
      targetCriterionId && ObjectId.isValid(targetCriterionId)
        ? new ObjectId(targetCriterionId)
        : cid;
    doc.then.percent = p;
    doc.then.targetCriterionId = targetId;
  }

  return rulesRepo.insertOne(doc);
}

async function updateRule({ id, payload }) {
  const rid = requireObjectId(id, "rule id");
  const {
    enabled,
    criterionId,
    operator,
    value,
    action,
    percent,
    targetCriterionId,
    note
  } = payload ?? {};

  const cid = requireObjectId(criterionId, "criterionId");
  const op = normalizeOperator(operator);
  if (!op) throw badRequest("Invalid operator.");
  const v = requireFiniteNumber(value, "Value");

  const act = normalizeAction(action);
  if (!act) throw badRequest("Invalid action.");

  const setDoc = {
    enabled: Boolean(enabled),
    when: { criterionId: cid, operator: op, value: v },
    then: { action: act },
    note: typeof note === "string" ? note.trim() : "",
    updatedAt: new Date()
  };

  if (act === "adjust_percent") {
    const p = requireFiniteNumber(percent, "Percent");
    const targetId =
      targetCriterionId && ObjectId.isValid(targetCriterionId)
        ? new ObjectId(targetCriterionId)
        : cid;
    setDoc.then.percent = p;
    setDoc.then.targetCriterionId = targetId;
  }

  const r = await rulesRepo.updateById(rid, setDoc);
  if (r.matchedCount === 0) throw notFound("Rule not found.");
  return { message: "Rule updated." };
}

async function deleteRule({ id }) {
  const rid = requireObjectId(id, "rule id");
  const r = await rulesRepo.deleteById(rid);
  if (r.deletedCount === 0) throw notFound("Rule not found.");
  return { message: "Rule deleted." };
}

module.exports = {
  listRules,
  createRule,
  updateRule,
  deleteRule
};
