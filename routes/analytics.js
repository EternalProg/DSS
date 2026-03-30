const express = require("express");
const { getDb } = require("../services/db");
const analytics = require("../services/analytics");

const router = express.Router();

router.post("/calculate", async (req, res) => {
  const db = getDb();
  const { strategies } = req.body;

  const selectedStrategies = strategies && strategies.length
    ? strategies
    : ["cautious", "additive", "multiplicative"];

  try {
    const [alternatives, criteria, evaluations] = await Promise.all([
      db.collection("alternatives").find({}).toArray(),
      db.collection("criteria").find({}).toArray(),
      db.collection("evaluations").find({}).toArray()
    ]);

    if (!alternatives.length) {
      return res.status(400).json({ message: "No alternatives found." });
    }

    if (!criteria.length) {
      return res.status(400).json({ message: "No criteria found." });
    }

    if (!evaluations.length) {
      return res.status(400).json({ message: "No evaluations found." });
    }

    const result = analytics.analyze(
      alternatives,
      criteria,
      evaluations,
      selectedStrategies
    );

    res.json(result);
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ message: "Failed to calculate analytics." });
  }
});

router.get("/", (req, res) => {
  res.json({
    status: "ready",
    availableStrategies: [
      {
        id: "cautious",
        name: "Обережна",
        formula: "Q(Ai) = min(wj * xij)",
        description: "Оцінка за найгіршим критерієм"
      },
      {
        id: "additive",
        name: "Адитивна",
        formula: "Q(Ai) = \u03a3(wj * xij)",
        description: "Сума зважених оцінок"
      },
      {
        id: "multiplicative",
        name: "Мультиплікативна",
        formula: "Q(Ai) = \u03a0(xij^wj)",
        description: "Добуток оцінок у степені ваг"
      }
    ]
  });
});

module.exports = router;
