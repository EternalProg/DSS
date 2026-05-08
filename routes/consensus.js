const express = require("express");
const { getDb } = require("../services/db");
const consensus = require("../services/consensus");

const router = express.Router();

function badRequest(res, message, errors = []) {
  return res.status(400).json({ message, errors });
}

async function applyCellsToEvaluations(db, cells, { sourceMethod, variant = null, p = null } = {}) {
  if (!Array.isArray(cells) || cells.length === 0) {
    return { ok: true, total: 0, matched: 0, modified: 0, upserted: 0 };
  }

  const now = new Date();
  const ops = [];
  for (const cell of cells) {
    const value = Number(cell?.value);
    if (!Number.isFinite(value)) continue;
    if (!cell?.alternativeId || !cell?.criterionId) continue;

    // Be tolerant to existing evaluations that might have string ids.
    const altId = cell.alternativeId;
    const critId = cell.criterionId;
    const altStr = typeof altId?.toString === "function" ? altId.toString() : String(altId);
    const critStr = typeof critId?.toString === "function" ? critId.toString() : String(critId);

    ops.push({
      updateOne: {
        filter: {
          $and: [
            { alternativeId: { $in: [altId, altStr] } },
            { criterionId: { $in: [critId, critStr] } }
          ]
        },
        update: {
          $set: {
            value,
            updatedAt: now,
            consensus: {
              method: sourceMethod,
              ...(variant != null ? { variant } : {}),
              ...(p != null ? { p } : {}),
              appliedAt: now
            }
          },
          // If upserting, Mongo can't infer alternativeId/criterionId from $in filter.
          // Provide them explicitly so the matrix UI can match these evaluations.
          $setOnInsert: { createdAt: now, alternativeId: altId, criterionId: critId }
        },
        upsert: true
      }
    });
  }

  if (ops.length === 0) {
    return { ok: true, total: 0, matched: 0, modified: 0, upserted: 0 };
  }

  const r = await db.collection("evaluations").bulkWrite(ops, { ordered: false });
  return {
    ok: true,
    total: ops.length,
    matched: r.matchedCount ?? 0,
    modified: r.modifiedCount ?? 0,
    upserted: r.upsertedCount ?? 0
  };
}

async function enrichAndRemapCells(db, cells, { allowHeuristicRemap = false } = {}) {
  const warnings = [];
  if (!Array.isArray(cells) || cells.length === 0) {
    return { cells: [], warnings, remap: null };
  }

  const altIds = Array.from(new Set(cells.map((c) => String(c.alternativeId))));
  const critIds = Array.from(new Set(cells.map((c) => String(c.criterionId))));

  const [allAlternatives, allCriteria] = await Promise.all([
    db.collection("alternatives").find({}).toArray(),
    db.collection("criteria").find({}).toArray()
  ]);

  const altById = new Map(allAlternatives.map((a) => [String(a._id), a]));
  const critById = new Map(allCriteria.map((c) => [String(c._id), c]));

  const missingAltIds = altIds.filter((id) => !altById.has(id));
  const missingCritIds = critIds.filter((id) => !critById.has(id));

  // Optional heuristic remap: if expertEvaluations reference a previous seed/import
  // and alternatives/criteria were recreated, ids won't match. If the counts match,
  // remap by stable ordering.
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

router.get("/methods", (req, res) => {
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
});

router.post("/calculate", async (req, res) => {
  const db = getDb();
  const { method, variant, p, applyToEvaluations } = req.body ?? {};

  if (!method || typeof method !== "string") {
    return badRequest(res, "Не задано method.", [
      { code: "MISSING_METHOD", hint: "method має бути одним з: E7, E1, E2" }
    ]);
  }

  const methodId = method.trim().toUpperCase();
  try {
    if (methodId === "E7") {
      const v = String(variant ?? "utilitarian").trim().toLowerCase();
      if (v !== "utilitarian" && v !== "egalitarian") {
        return badRequest(res, "Некоректний variant для E7.", [
          { code: "BAD_VARIANT", hint: "variant: utilitarian | egalitarian" }
        ]);
      }

      const [experts, expertEvaluations] = await Promise.all([
        db.collection("experts").find({}).toArray(),
        db.collection("expertEvaluations").find({}).toArray()
      ]);

      if (!experts.length) {
        return badRequest(res, "Немає експертів.", [
          { code: "NO_EXPERTS", hint: "Імпортуйте CSV або створіть експертів." }
        ]);
      }
      if (!expertEvaluations.length) {
        return badRequest(res, "Немає експертних оцінок.", [
          { code: "NO_EXPERT_EVALUATIONS", hint: "Імпортуйте оцінки експертів (CSV)." }
        ]);
      }

      const result = consensus.calculateE7Matrix({ experts, expertEvaluations, variant: v });

      // Enrich with names; also allow remap when applying to the main evaluations matrix.
      const enriched = await enrichAndRemapCells(db, result.cells, {
        allowHeuristicRemap: true
      });
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

        result.applied = await applyCellsToEvaluations(db, cellsToApply, {
          sourceMethod: "E7",
          variant: v
        });
      }
      return res.json(result);
    }

    if (methodId === "E1") {
      const [experts, expertEvaluations] = await Promise.all([
        db.collection("experts").find({}).toArray(),
        db.collection("expertEvaluations").find({}).toArray()
      ]);

      if (!experts.length) {
        return badRequest(res, "Немає експертів.", [
          { code: "NO_EXPERTS", hint: "Імпортуйте CSV або створіть експертів." }
        ]);
      }
      if (!expertEvaluations.length) {
        return badRequest(res, "Немає експертних оцінок.", [
          { code: "NO_EXPERT_EVALUATIONS", hint: "Імпортуйте оцінки експертів (CSV)." }
        ]);
      }

      const result = consensus.calculateE1Matrix({ experts, expertEvaluations });

      const enriched = await enrichAndRemapCells(db, result.cells, {
        allowHeuristicRemap: true
      });
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

        result.applied = await applyCellsToEvaluations(db, cellsToApply, {
          sourceMethod: "E1"
        });
      }
      return res.json(result);
    }

    if (methodId === "E2") {
      const [experts, expertTriads] = await Promise.all([
        db.collection("experts").find({}).toArray(),
        db.collection("expertTriads").find({}).toArray()
      ]);

      if (!experts.length) {
        return badRequest(res, "Немає експертів.", [
          { code: "NO_EXPERTS", hint: "Імпортуйте CSV або створіть експертів." }
        ]);
      }
       if (!expertTriads.length) {
         return badRequest(res, "Немає триадних оцінок (E2).", [
           {
             code: "NO_TRIADS",
              message: "У базі немає тріадних оцінок (optimistic/realistic/pessimistic) для E2.",
              hint:
                "Додайте оцінки optimistic/realistic/pessimistic для експертів (буде окремий UI/імпорт)."
            }
          ]);
        }

      const result = consensus.calculateE2Matrix({ experts, expertTriads, p });
      if (p != null && p !== "") {
        result.p = p;
      }

      const enriched = await enrichAndRemapCells(db, result.cells, {
        allowHeuristicRemap: true
      });
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

        result.applied = await applyCellsToEvaluations(db, cellsToApply, {
          sourceMethod: "E2",
          p: p ?? null
        });
      }
      return res.json(result);
    }

    return badRequest(res, "Невідомий method.", [
      { code: "UNKNOWN_METHOD", hint: "method має бути одним з: E7, E1, E2" }
    ]);
  } catch (error) {
    console.error("Consensus error:", error);
    return res.status(500).json({ message: "Не вдалося обчислити узгодження." });
  }
});

module.exports = router;
