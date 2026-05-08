const express = require("express");
const { getDb } = require("../services/db");
const { importVotingCsv, calculateVotingWeights, applyWeightsToCriteria } = require("../services/voting");

const router = express.Router();

router.post(
  "/import",
  express.text({
    type: ["text/csv", "text/plain", "application/csv", "application/vnd.ms-excel"],
    limit: "10mb"
  }),
  async (req, res) => {
    const db = getDb();
    const { method } = req.query;
    const csvText = req.body;

    if (!csvText || typeof csvText !== "string" || !csvText.trim()) {
      return res.status(400).json({
        message: "CSV порожній.",
        errors: [{ code: "CSV_EMPTY", hint: "Надішліть тіло запиту як text/csv." }]
      });
    }

    const methodId = String(method || "").trim().toLowerCase();
    if (!methodId) {
      return res.status(400).json({
        message: "Не задано метод голосування (method).",
        errors: [{ code: "MISSING_METHOD", hint: "method: plurality | borda | copeland | simpson" }]
      });
    }

    try {
      const imported = await importVotingCsv({ db, csvText });
      if (!imported.ok) {
        return res.status(400).json({ message: imported.message || "Помилка імпорту.", ...imported });
      }

      const experts = await db.collection("experts").find({}).toArray();
      const criterionIds = Array.from(
        new Set(
          imported.ballots.flatMap((b) => Array.from(b.ranks.keys()))
        )
      );

      const voting = calculateVotingWeights({
        method: methodId,
        ballots: imported.ballots,
        experts,
        criterionIds
      });
      if (!voting.ok) {
        return res.status(400).json({
          message: "Невідомий метод голосування.",
          errors: [{ code: "UNKNOWN_METHOD", hint: "plurality | borda | copeland | simpson" }]
        });
      }

      const applied = await applyWeightsToCriteria({ db, weightsByCriterionId: voting.weights });

      return res.json({
        ok: true,
        method: methodId,
        imported: imported.summary,
        warnings: imported.warnings,
        applied,
        ranked: voting.ranked
      });
    } catch (error) {
      console.error("Voting import error:", error);
      return res.status(500).json({ message: "Не вдалося імпортувати голосування." });
    }
  }
);

module.exports = router;
