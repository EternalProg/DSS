const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../services/db");

const router = express.Router();

router.get("/", async (req, res) => {
  const db = getDb();
  const alternatives = await db.collection("alternatives").find({}).toArray();
  res.json(alternatives);
});

router.post("/", async (req, res) => {
  const db = getDb();
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Name is required." });
  }

  try {
    const result = await db.collection("alternatives").insertOne({
      name: name.trim(),
      description: description ? description.trim() : "",
      createdAt: new Date()
    });
    res.status(201).json({ _id: result.insertedId });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Alternative name already exists." });
    }
    res.status(500).json({ message: "Failed to create alternative." });
  }
});

router.put("/:id", async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, description } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid alternative id." });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Name is required." });
  }

  try {
    const result = await db.collection("alternatives").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          name: name.trim(),
          description: description ? description.trim() : "",
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Alternative not found." });
    }

    res.json({ message: "Alternative updated." });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Alternative name already exists." });
    }
    res.status(500).json({ message: "Failed to update alternative." });
  }
});

module.exports = router;
