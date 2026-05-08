const analyticsOrchestrator = require("../services/analyticsOrchestrator");
function status(req, res) {
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
}

async function calculate(req, res) {
  const { strategies, scaleMode } = req.body ?? {};
  const result = await analyticsOrchestrator.calculate({ strategies, scaleMode });
  res.json(result);
}

module.exports = {
  status,
  calculate
};
