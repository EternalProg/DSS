const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../services/db");

const router = express.Router();

function badRequest(res, message) {
  return res.status(400).json({ message });
}

function normalizeOperator(op) {
  const x = String(op ?? "").trim();
  const allowed = new Set([">", ">=", "<", "<=", "==", "!="]);
  return allowed.has(x) ? x : null;
}

function normalizeAction(action) {
  const x = String(action ?? "").trim();
  const allowed = new Set(["exclude", "adjust_percent"]);
  return allowed.has(x) ? x : null;
}

router.get("/", async (req, res) => {
  const db = getDb();
  const rules = await db.collection("rules").find({}).sort({ createdAt: -1 }).toArray();
  res.json(rules);
});

router.post("/", async (req, res) => {
  const db = getDb();
  const { enabled = true, criterionId, operator, value, action, percent, targetCriterionId, note } =
    req.body ?? {};

  if (!ObjectId.isValid(criterionId)) {
    return badRequest(res, "Valid criterionId is required.");
  }
  const op = normalizeOperator(operator);
  if (!op) return badRequest(res, "Invalid operator.");
  const v = Number(value);
  if (!Number.isFinite(v)) return badRequest(res, "Value must be a number.");

  const act = normalizeAction(action);
  if (!act) return badRequest(res, "Invalid action.");

  const doc = {
    enabled: Boolean(enabled),
    when: {
      criterionId: new ObjectId(criterionId),
      operator: op,
      value: v
    },
    then: { action: act },
    note: typeof note === "string" ? note.trim() : "",
    createdAt: new Date()
  };

  if (act === "adjust_percent") {
    const p = Number(percent);
    if (!Number.isFinite(p)) return badRequest(res, "Percent must be a number.");
    const targetId = targetCriterionId && ObjectId.isValid(targetCriterionId)
      ? new ObjectId(targetCriterionId)
      : new ObjectId(criterionId);
    doc.then.percent = p;
    doc.then.targetCriterionId = targetId;
  }

  const result = await db.collection("rules").insertOne(doc);
  res.status(201).json({ _id: result.insertedId });
});

router.put("/:id", async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return badRequest(res, "Invalid rule id.");

  const { enabled, criterionId, operator, value, action, percent, targetCriterionId, note } =
    req.body ?? {};

  if (!ObjectId.isValid(criterionId)) {
    return badRequest(res, "Valid criterionId is required.");
  }
  const op = normalizeOperator(operator);
  if (!op) return badRequest(res, "Invalid operator.");
  const v = Number(value);
  if (!Number.isFinite(v)) return badRequest(res, "Value must be a number.");

  const act = normalizeAction(action);
  if (!act) return badRequest(res, "Invalid action.");

  const setDoc = {
    enabled: Boolean(enabled),
    when: {
      criterionId: new ObjectId(criterionId),
      operator: op,
      value: v
    },
    then: { action: act },
    note: typeof note === "string" ? note.trim() : "",
    updatedAt: new Date()
  };

  if (act === "adjust_percent") {
    const p = Number(percent);
    if (!Number.isFinite(p)) return badRequest(res, "Percent must be a number.");
    const targetId = targetCriterionId && ObjectId.isValid(targetCriterionId)
      ? new ObjectId(targetCriterionId)
      : new ObjectId(criterionId);
    setDoc.then.percent = p;
    setDoc.then.targetCriterionId = targetId;
  }

  const r = await db.collection("rules").updateOne({ _id: new ObjectId(id) }, { $set: setDoc });
  if (r.matchedCount === 0) return res.status(404).json({ message: "Rule not found." });
  res.json({ message: "Rule updated." });
});

router.delete("/:id", async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return badRequest(res, "Invalid rule id.");
  const r = await db.collection("rules").deleteOne({ _id: new ObjectId(id) });
  if (r.deletedCount === 0) return res.status(404).json({ message: "Rule not found." });
  res.json({ message: "Rule deleted." });
});

module.exports = router;
