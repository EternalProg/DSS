const express = require("express");
const { getDb } = require("../services/db");

const router = express.Router();

router.get("/", async (req, res) => {
  const db = getDb();
  const alternatives = await db.collection("alternatives").find({}).toArray();
  const criteria = await db.collection("criteria").find({}).toArray();
  const evaluations = await db.collection("evaluations").find({}).toArray();

  const evaluationMap = new Map();
  evaluations.forEach((evaluation) => {
    evaluationMap.set(
      `${evaluation.alternativeId.toString()}-${evaluation.criterionId.toString()}`,
      evaluation
    );
  });

  const rows = alternatives.map((alternative) => {
    const cells = criteria.map((criterion) => {
      const key = `${alternative._id.toString()}-${criterion._id.toString()}`;
      const evaluation = evaluationMap.get(key);
      return {
        criterionId: criterion._id,
        value: evaluation ? evaluation.value : null,
        evaluationId: evaluation ? evaluation._id : null
      };
    });

    return {
      alternativeId: alternative._id,
      alternativeName: alternative.name,
      values: cells
    };
  });

  res.json({ alternatives, criteria, rows });
});

module.exports = router;
