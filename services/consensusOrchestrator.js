const consensus = require("../computations/consensus");
const expertsRepo = require("../data/expertsRepo");
const expertEvaluationsRepo = require("../data/expertEvaluationsRepo");
const expertTriadsRepo = require("../data/expertTriadsRepo");
const alternativesRepo = require("../data/alternativesRepo");
const criteriaRepo = require("../data/criteriaRepo");
const evaluationsRepo = require("../data/evaluationsRepo");
const { badRequest } = require("../utils/errors");

async function enrichAndRemapCells(cells, { allowHeuristicRemap = false } = {}) {
  const warnings = [];
  if (!Array.isArray(cells) || cells.length === 0) {
    return { cells: [], warnings, remap: null };
  }

  const altIds = Array.from(new Set(cells.map((c) => String(c.alternativeId))));
  const critIds = Array.from(new Set(cells.map((c) => String(c.criterionId))));

  const [allAlternatives, allCriteria] = await Promise.all([
    alternativesRepo.listAll(),
    criteriaRepo.listAll()
  ]);

  const altById = new Map(allAlternatives.map((a) => [String(a._id), a]));
  const critById = new Map(allCriteria.map((c) => [String(c._id), c]));

  const missingAltIds = altIds.filter((id) => !altById.has(id));
  const missingCritIds = critIds.filter((id) => !critById.has(id));

  let remap = null;
  if (
    allowHeuristicRemap &&
    (missingAltIds.length || missingCritIds.length) &&
    altIds.length === allAlternatives.length &&
    critIds.length === allCriteria.length
  ) {
    const oldAltOrdered = [...altIds].sort();
    const oldCritOrdered = [...critIds].sort();

    const altIdRemap = new Map(oldAltOrdered.map((oldId, i) => [oldId, allAlternatives[i]?._id]));
    const critIdRemap = new Map(oldCritOrdered.map((oldId, i) => [oldId, allCriteria[i]?._id]));

    if (oldAltOrdered.every((id) => altIdRemap.get(id)) && oldCritOrdered.every((id) => critIdRemap.get(id))) {
      remap = { altIdRemap, critIdRemap };
      warnings.push({
        code: "ID_MISMATCH_REMAP",
        message:
          "Експертні оцінки посилаються на альтернативи/критерії, яких немає у поточних довідниках. Застосовано евристичне зіставлення за порядком.",
        hint:
          "Щоб уникнути ризику помилкового зіставлення, виконайте повторний імпорт CSV після остаточного налаштування альтернатив/критеріїв (або очистіть БД і імпортуйте заново)."
      });
    }
  }

  const enriched = cells.map((cell) => {
    const altId = String(cell.alternativeId);
    const critId = String(cell.criterionId);

    const mappedAltId = remap?.altIdRemap?.get(altId);
    const mappedCritId = remap?.critIdRemap?.get(critId);
    const altDoc = altById.get(altId) ?? (mappedAltId ? altById.get(String(mappedAltId)) : null);
    const critDoc = critById.get(critId) ?? (mappedCritId ? critById.get(String(mappedCritId)) : null);

    return {
      ...cell,
      ...(altDoc?.name ? { alternativeName: altDoc.name } : {}),
      ...(critDoc?.name ? { criterionName: critDoc.name } : {})
    };
  });

  return { cells: enriched, warnings, remap };
}

async function calculate({ method, variant, p, applyToEvaluations } = {}) {
  if (!method || typeof method !== "string") {
    throw badRequest("Не задано method.", [{ code: "MISSING_METHOD", hint: "method має бути одним з: E7, E1, E2" }]);
  }

  const methodId = method.trim().toUpperCase();

  const experts = await expertsRepo.listAll();
  if (!experts.length) {
    throw badRequest("Немає експертів.", [{ code: "NO_EXPERTS", hint: "Імпортуйте CSV або створіть експертів." }]);
  }

  if (methodId === "E7") {
    const v = String(variant ?? "utilitarian").trim().toLowerCase();
    if (v !== "utilitarian" && v !== "egalitarian") {
      throw badRequest("Некоректний variant для E7.", [{ code: "BAD_VARIANT", hint: "variant: utilitarian | egalitarian" }]);
    }

    const expertEvaluations = await expertEvaluationsRepo.listAll();
    if (!expertEvaluations.length) {
      throw badRequest("Немає експертних оцінок.", [{ code: "NO_EXPERT_EVALUATIONS", hint: "Імпортуйте оцінки експертів (CSV)." }]);
    }

    const result = consensus.calculateE7Matrix({ experts, expertEvaluations, variant: v });
    const enriched = await enrichAndRemapCells(result.cells, { allowHeuristicRemap: true });
    result.cells = enriched.cells;
    if (enriched.warnings.length) result.warnings = enriched.warnings;

    if (applyToEvaluations) {
      const cellsToApply = enriched.remap
        ? result.cells.map((c) => ({
            ...c,
            alternativeId: enriched.remap.altIdRemap.get(String(c.alternativeId)) ?? c.alternativeId,
            criterionId: enriched.remap.critIdRemap.get(String(c.criterionId)) ?? c.criterionId
          }))
        : result.cells;

      result.applied = await evaluationsRepo.bulkUpsertFromCells({
        cells: cellsToApply,
        consensus: { method: "E7", variant: v }
      });
    }

    return result;
  }

  if (methodId === "E1") {
    const expertEvaluations = await expertEvaluationsRepo.listAll();
    if (!expertEvaluations.length) {
      throw badRequest("Немає експертних оцінок.", [{ code: "NO_EXPERT_EVALUATIONS", hint: "Імпортуйте оцінки експертів (CSV)." }]);
    }

    const result = consensus.calculateE1Matrix({ experts, expertEvaluations });
    const enriched = await enrichAndRemapCells(result.cells, { allowHeuristicRemap: true });
    result.cells = enriched.cells;
    if (enriched.warnings.length) result.warnings = enriched.warnings;

    if (applyToEvaluations) {
      const cellsToApply = enriched.remap
        ? result.cells.map((c) => ({
            ...c,
            alternativeId: enriched.remap.altIdRemap.get(String(c.alternativeId)) ?? c.alternativeId,
            criterionId: enriched.remap.critIdRemap.get(String(c.criterionId)) ?? c.criterionId
          }))
        : result.cells;

      result.applied = await evaluationsRepo.bulkUpsertFromCells({
        cells: cellsToApply,
        consensus: { method: "E1" }
      });
    }

    return result;
  }

  if (methodId === "E2") {
    const expertTriads = await expertTriadsRepo.listAll();
    if (!expertTriads.length) {
      throw badRequest("Немає тріадних оцінок (E2).", [{ code: "NO_TRIADS", hint: "Імпортуйте тріади (Екран 1)." }]);
    }

    const result = consensus.calculateE2Matrix({ experts, expertTriads, p: p ?? null });
    const enriched = await enrichAndRemapCells(result.cells, { allowHeuristicRemap: true });
    result.cells = enriched.cells;
    if (enriched.warnings.length) result.warnings = enriched.warnings;

    if (applyToEvaluations) {
      const cellsToApply = enriched.remap
        ? result.cells.map((c) => ({
            ...c,
            alternativeId: enriched.remap.altIdRemap.get(String(c.alternativeId)) ?? c.alternativeId,
            criterionId: enriched.remap.critIdRemap.get(String(c.criterionId)) ?? c.criterionId
          }))
        : result.cells;

      result.applied = await evaluationsRepo.bulkUpsertFromCells({
        cells: cellsToApply,
        consensus: { method: "E2", ...(p != null ? { p } : {}) }
      });
    }

    return result;
  }

  throw badRequest("Невідомий метод.", [{ code: "UNKNOWN_METHOD", hint: "E7 | E1 | E2" }]);
}

module.exports = {
  calculate
};
