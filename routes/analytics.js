const express = require("express");
const { getDb } = require("../services/db");
const analytics = require("../services/analytics");

const router = express.Router();

router.post("/calculate", async (req, res) => {
  const db = getDb();
  const { strategies, scaleMode } = req.body;

  const selectedStrategies = strategies && strategies.length
    ? strategies
    : ["cautious", "additive", "multiplicative"];

  try {
    const [alternatives, criteria, evaluations, rules] = await Promise.all([
      db.collection("alternatives").find({}).toArray(),
      db.collection("criteria").find({}).toArray(),
      db.collection("evaluations").find({}).toArray(),
      db.collection("rules").find({}).toArray()
    ]);

    if (!alternatives.length) {
      return res.status(400).json({ message: "Не знайдено жодної альтернативи." });
    }

    if (!criteria.length) {
      return res.status(400).json({ message: "Не знайдено жодного критерію." });
    }

    if (!evaluations.length) {
      return res.status(400).json({ message: "Не знайдено жодної оцінки." });
    }

    const prepared = analytics.applyRulesAndThresholds({
      alternatives,
      criteria,
      evaluations,
      rules
    });

    const scaled = analytics.normalizeEvaluations({
      alternatives: prepared.alternatives,
      criteria,
      evaluations: prepared.evaluations,
      mode: scaleMode
    });

    if (!prepared.alternatives.length) {
      return res.status(400).json({
        message:
          "Після застосування порогів/правил не залишилося допустимих альтернатив. Послабте пороги або вимкніть правила."
      });
    }

    const validationErrors = analytics.validateAnalysisData(
      prepared.alternatives,
      criteria,
      scaled.evaluations,
      selectedStrategies
    );

    if (validationErrors.length) {
      const visibleErrors = validationErrors.slice(0, 3).join(" ");
      const hiddenCount = validationErrors.length - 3;
      const hiddenSuffix = hiddenCount > 0 ? ` (і ще ${hiddenCount} помилок).` : "";

      return res.status(400).json({
        message: `Неможливо виконати розрахунок. ${visibleErrors}${hiddenSuffix}`
      });
    }

    const result = analytics.analyze(
      prepared.alternatives,
      criteria,
      scaled.evaluations,
      selectedStrategies,
      { scaleMode: scaled.meta.scaleMode }
    );

    result.logic = prepared.meta;
    result.logic.scaleMode = scaled.meta.scaleMode;
    result.counts = {
      before: { alternatives: alternatives.length, evaluations: evaluations.length, rules: rules.length },
      after: { alternatives: prepared.alternatives.length, evaluations: prepared.evaluations.length }
    };

    res.json(result);
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ message: "Не вдалося виконати аналітичний розрахунок." });
  }
});

router.get("/", (req, res) => {
  res.json({
    status: "ready",
    availableStrategies: [
      {
        id: "cautious",
        name: "Обережна",
        formula: "Q(Ai) = min(sj * wj * xij)",
        description: "Мінімум зі знакових зважених оцінок"
      },
      {
        id: "additive",
        name: "Адитивна",
        formula: "Q(Ai) = sum(sj * wj * xij)",
        description: "Сума знакових зважених оцінок"
      },
      {
        id: "multiplicative",
        name: "Мультиплікативна",
        formula: "Q(Ai) = product(xij^(sj * wj))",
        description: "Добуток оцінок зі знаковими показниками степеня"
      }
    ]
  });
});

module.exports = router;
