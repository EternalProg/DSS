const { ObjectId } = require("mongodb");
const { getDb } = require("../services/db");

async function listAll() {
  const db = getDb();
  return db.collection("evaluations").find({}).toArray();
}

async function upsertByPair({ alternativeId, criterionId, value }) {
  const db = getDb();
  const now = new Date();
  return db.collection("evaluations").updateOne(
    { alternativeId: new ObjectId(alternativeId), criterionId: new ObjectId(criterionId) },
    {
      $set: { value, updatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
}

async function updateById(id, { value }) {
  const db = getDb();
  return db.collection("evaluations").updateOne(
    { _id: new ObjectId(id) },
    { $set: { value, updatedAt: new Date() } }
  );
}

async function deleteByAlternativeId(alternativeId) {
  const db = getDb();
  return db.collection("evaluations").deleteMany({ alternativeId: new ObjectId(alternativeId) });
}

async function deleteByCriterionId(criterionId) {
  const db = getDb();
  return db.collection("evaluations").deleteMany({ criterionId: new ObjectId(criterionId) });
}

async function bulkUpsertFromCells({ cells, consensus } = {}) {
  const db = getDb();
  if (!Array.isArray(cells) || cells.length === 0) {
    return { ok: true, total: 0, matched: 0, modified: 0, upserted: 0 };
  }

  const now = new Date();
  const ops = [];

  for (const cell of cells) {
    const value = Number(cell?.value);
    if (!Number.isFinite(value)) continue;
    if (!cell?.alternativeId || !cell?.criterionId) continue;

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
            ...(consensus
              ? {
                  consensus: {
                    ...consensus,
                    appliedAt: now
                  }
                }
              : {})
          },
          $setOnInsert: { createdAt: now, alternativeId: altId, criterionId: critId }
        },
        upsert: true
      }
    });
  }

  if (!ops.length) return { ok: true, total: 0, matched: 0, modified: 0, upserted: 0 };
  const r = await db.collection("evaluations").bulkWrite(ops, { ordered: false });
  return {
    ok: true,
    total: ops.length,
    matched: r.matchedCount ?? 0,
    modified: r.modifiedCount ?? 0,
    upserted: r.upsertedCount ?? 0
  };
}

module.exports = {
  listAll,
  upsertByPair,
  updateById,
  deleteByAlternativeId,
  deleteByCriterionId,
  bulkUpsertFromCells
};
