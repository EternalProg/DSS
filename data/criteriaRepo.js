const { ObjectId } = require("mongodb");
const { getDb } = require("../services/db");

async function listAll() {
  const db = getDb();
  return db.collection("criteria").find({}).toArray();
}

async function insertOne(doc) {
  const db = getDb();
  const result = await db.collection("criteria").insertOne(doc);
  return { _id: result.insertedId };
}

async function updateById(id, updateDoc) {
  const db = getDb();
  return db.collection("criteria").updateOne({ _id: new ObjectId(id) }, updateDoc);
}

async function deleteById(id) {
  const db = getDb();
  return db.collection("criteria").deleteOne({ _id: new ObjectId(id) });
}

async function bulkUpdateWeights({ weightsByCriterionId, source = "voting" } = {}) {
  const db = getDb();
  const now = new Date();
  const ops = [];

  for (const [criterionIdStr, weight] of weightsByCriterionId.entries()) {
    if (!ObjectId.isValid(criterionIdStr)) continue;
    const w = Number(weight);
    if (!Number.isFinite(w)) continue;
    ops.push({
      updateOne: {
        filter: { _id: new ObjectId(criterionIdStr) },
        update: { $set: { weight: w, weightSource: source, updatedAt: now } }
      }
    });
  }

  if (!ops.length) return { ok: true, updated: 0 };
  const r = await db.collection("criteria").bulkWrite(ops, { ordered: false });
  return { ok: true, updated: r.modifiedCount ?? 0 };
}

module.exports = {
  listAll,
  insertOne,
  updateById,
  deleteById,
  bulkUpdateWeights
};
