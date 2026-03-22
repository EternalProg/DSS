const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../services/db");

const router = express.Router();

router.get("/", async (req, res) => {
  const db = getDb();
  const evaluations = await db.collection("evaluations").find({}).toArray();
  res.json(evaluations);
});

router.post("/", async (req, res) => {
  const db = getDb();
  const { alternativeId, criterionId, value } = req.body;

  if (!ObjectId.isValid(alternativeId) || !ObjectId.isValid(criterionId)) {
    return res
      .status(400)
      .json({ message: "Valid alternativeId and criterionId are required." });
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return res.status(400).json({ message: "Value must be a number." });
  }

  try {
    const now = new Date();
    const result = await db.collection("evaluations").updateOne(
      {
        alternativeId: new ObjectId(alternativeId),
        criterionId: new ObjectId(criterionId)
      },
      {
        $set: {
          value: numericValue,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );

    if (result.upsertedId) {
      return res.status(201).json({ _id: result.upsertedId });
    }

    res.json({ message: "Evaluation updated." });
  } catch (error) {
    res.status(500).json({ message: "Failed to save evaluation." });
  }
});

router.put("/:id", async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { value } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid evaluation id." });
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return res.status(400).json({ message: "Value must be a number." });
  }

  const result = await db.collection("evaluations").updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        value: numericValue,
        updatedAt: new Date()
      }
    }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ message: "Evaluation not found." });
  }

  res.json({ message: "Evaluation updated." });
});

module.exports = router;
