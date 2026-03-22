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
  const { name, type, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Name is required." });
  }

  if (!allowedTypes.includes(type)) {
    return res
      .status(400)
      .json({ message: "Type must be 'maximize' or 'minimize'." });
  }

  try {
    const result = await db.collection("criteria").insertOne({
      name: name.trim(),
      type,
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
  const { name, type, description } = req.body;

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

  try {
    const result = await db.collection("criteria").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          name: name.trim(),
          type,
          description: description ? description.trim() : "",
          updatedAt: new Date()
        }
      }
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

module.exports = router;
