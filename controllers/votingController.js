const votingImportService = require("../services/votingImportService");
const votingApplyService = require("../services/votingApplyService");
const { calculateVotingWeights } = require("../computations/voting");
const expertsRepo = require("../data/expertsRepo");
const { badRequest } = require("../utils/errors");

async function importCsv(req, res) {
  const { method } = req.query;
  const csvText = req.body;

  if (!csvText || typeof csvText !== "string" || !csvText.trim()) {
    throw badRequest("CSV порожній.", [{ code: "CSV_EMPTY", hint: "Надішліть тіло запиту як text/csv." }]);
  }

  const methodId = String(method || "").trim().toLowerCase();
  if (!methodId) {
    throw badRequest("Не задано метод голосування (method).", [
      { code: "MISSING_METHOD", hint: "method: plurality | borda | copeland | simpson" }
    ]);
  }

  const imported = await votingImportService.importVotingCsv({ csvText });
  if (!imported.ok) {
    return res.status(400).json({ message: imported.message || "Помилка імпорту.", ...imported });
  }

  const experts = await expertsRepo.listAll();
  const criterionIds = Array.from(new Set(imported.ballots.flatMap((b) => Array.from(b.ranks.keys()))));

  const voting = calculateVotingWeights({ method: methodId, ballots: imported.ballots, experts, criterionIds });
  if (!voting.ok) {
    return res.status(400).json({
      message: "Невідомий метод голосування.",
      errors: [{ code: "UNKNOWN_METHOD", hint: "plurality | borda | copeland | simpson" }]
    });
  }

  const applied = await votingApplyService.applyWeightsToCriteria({ weightsByCriterionId: voting.weights });

  return res.json({
    ok: true,
    method: methodId,
    imported: imported.summary,
    warnings: imported.warnings,
    applied,
    ranked: voting.ranked
  });
}

module.exports = { importCsv };
