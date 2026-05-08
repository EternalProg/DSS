const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../services/db");

const router = express.Router();
const allowedTypes = ["maximize", "minimize"];

router.get("/", async (req, res) => {
  const db = getDb();
  const criteria = await db.collection("criteria").find({}).toArray();
  res.json(criteria);
});

router.post("/", async (req, res) => {
  const db = getDb();
  const { name, type, description, code } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Name is required." });
  }

  if (!allowedTypes.includes(type)) {
    return res
      .status(400)
      .json({ message: "Type must be 'maximize' or 'minimize'." });
  }

  try {
    const normalizedCode =
      code != null && String(code).trim() ? String(code).trim().toUpperCase() : null;
    if (normalizedCode && !/^C\d+$/.test(normalizedCode)) {
      return res
        .status(400)
        .json({ message: "Code повинен мати вигляд C<number> (наприклад, C1)." });
    }

    const result = await db.collection("criteria").insertOne({
      name: name.trim(),
      type,
      ...(normalizedCode ? { code: normalizedCode } : {}),
      description: description ? description.trim() : "",
      createdAt: new Date()
    });
    res.status(201).json({ _id: result.insertedId });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Criterion name already exists." });
    }
    res.status(500).json({ message: "Failed to create criterion." });
  }
});

router.put("/:id", async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, type, description, code } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid criterion id." });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Name is required." });
  }

  if (!allowedTypes.includes(type)) {
    return res
      .status(400)
      .json({ message: "Type must be 'maximize' or 'minimize'." });
  }

  const hasCodeField = Object.prototype.hasOwnProperty.call(req.body, "code");
  const normalizedCode =
    code != null && String(code).trim() ? String(code).trim().toUpperCase() : null;
  if (hasCodeField && normalizedCode && !/^C\d+$/.test(normalizedCode)) {
    return res
      .status(400)
      .json({ message: "Code повинен мати вигляд C<number> (наприклад, C1)." });
  }

  try {
    const setDoc = {
      name: name.trim(),
      type,
      description: description ? description.trim() : "",
      updatedAt: new Date()
    };

    const updateDoc = { $set: setDoc };
    if (hasCodeField) {
      if (normalizedCode) {
        updateDoc.$set.code = normalizedCode;
      } else {
        updateDoc.$unset = { code: "" };
      }
    }

    const result = await db.collection("criteria").updateOne(
      { _id: new ObjectId(id) },
      updateDoc
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Criterion not found." });
    }

    res.json({ message: "Criterion updated." });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Criterion name already exists." });
    }
    res.status(500).json({ message: "Failed to update criterion." });
  }
});

router.patch("/:id/weight", async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { weight } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid criterion id." });
  }

  const numericWeight = Number(weight);
  if (!Number.isFinite(numericWeight) || numericWeight < 1 || numericWeight > 10) {
    return res.status(400).json({ message: "Weight must be a number from 1 to 10." });
  }

  try {
    const result = await db.collection("criteria").updateOne(
      { _id: new ObjectId(id) },
      { $set: { weight: numericWeight, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Criterion not found." });
    }

    res.json({ message: "Weight updated." });
  } catch (error) {
    res.status(500).json({ message: "Failed to update weight." });
  }
});

router.patch("/:id/threshold", async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { enabled, value, note } = req.body ?? {};

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid criterion id." });
  }

  const isEnabled = Boolean(enabled);
  const numericValue = value === "" || value == null ? null : Number(value);
  // Allow enabling a threshold before the user types a numeric value.
  // When value is provided, it must be numeric.
  if (numericValue != null && !Number.isFinite(numericValue)) {
    return res.status(400).json({ message: "Threshold value must be a number." });
  }

  try {
    const update = {
      $set: {
        thresholdEnabled: isEnabled,
        ...(isEnabled && numericValue != null ? { thresholdValue: numericValue } : {}),
        ...(typeof note === "string" ? { thresholdNote: note.trim() } : {}),
        updatedAt: new Date()
      }
    };

    // If disabled, always clear the threshold value.
    // If enabled but value is missing/empty, also clear it (user hasn't set it yet).
    if (!isEnabled || (isEnabled && numericValue == null)) {
      update.$unset = { thresholdValue: "" };
    }

    const result = await db.collection("criteria").updateOne(
      { _id: new ObjectId(id) },
      update
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Criterion not found." });
    }

    res.json({ message: "Threshold updated." });
  } catch (error) {
    res.status(500).json({ message: "Failed to update threshold." });
  }
});

router.delete("/:id", async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid criterion id." });
  }

  const criterionId = new ObjectId(id);

  try {
    const result = await db.collection("criteria").deleteOne({
      _id: criterionId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Criterion not found." });
    }

    await db.collection("evaluations").deleteMany({ criterionId });

    res.json({ message: "Criterion deleted." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete criterion." });
  }
});

module.exports = router;
