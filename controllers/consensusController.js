const consensusOrchestrator = require("../services/consensusOrchestrator");
function methods(req, res) {
  res.json({
    methods: [
      {
        id: "E7",
        name: "Алгебраїчний (Експертиза 7)",
        variants: [
          { id: "utilitarian", name: "Утилітарний" },
          { id: "egalitarian", name: "Егалітарний" }
        ]
      },
      {
        id: "E1",
        name: "Статистичний (Експертиза 1)",
        variants: [{ id: "weightedMean", name: "Σ(αᵢ·aᵢ) + σ²" }]
      },
      {
        id: "E2",
        name: "Статистичний (Експертиза 2)",
        variants: [{ id: "triad", name: "(опт/реал/пес) + σ²" }]
      }
    ]
  });
}

async function calculate(req, res) {
  const result = await consensusOrchestrator.calculate(req.body ?? {});
  res.json(result);
}

module.exports = {
  methods,
  calculate
};
