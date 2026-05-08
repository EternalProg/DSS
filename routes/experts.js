const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../services/db");
const { getPsychTypeConfig } = require("../services/consensus");

const router = express.Router();

router.get("/", async (req, res) => {
  const db = getDb();
  const experts = await db.collection("experts").find({}).toArray();
  res.json(experts);
});

router.patch("/:id", async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid expert id." });
  }

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(req.body, "competenceK")) {
    const k = Number(req.body.competenceK);
    if (!Number.isFinite(k) || k <= 0 || k > 1e9) {
      return res.status(400).json({ message: "competenceK must be a positive number." });
    }
    updates.competenceK = k;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "psychType")) {
    const raw = String(req.body.psychType ?? "").trim().toLowerCase();
    // Validate by mapping (defaults to realist, but we keep strict validation for UI correctness).
    const allowed = ["realist", "optimist", "pessimist"];
    if (!allowed.includes(raw)) {
      return res.status(400).json({
        message: "psychType must be one of: realist, optimist, pessimist."
      });
    }
    // Ensure config exists.
    getPsychTypeConfig(raw);
    updates.psychType = raw;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: "No fields to update." });
  }

  updates.updatedAt = new Date();

  const result = await db.collection("experts").updateOne(
    { _id: new ObjectId(id) },
    { $set: updates }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ message: "Expert not found." });
  }

  res.json({ message: "Expert updated." });
});

module.exports = router;
