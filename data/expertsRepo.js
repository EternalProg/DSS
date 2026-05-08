const { ObjectId } = require("mongodb");
const { getDb } = require("../services/db");

async function listAll() {
  const db = getDb();
  return db.collection("experts").find({}).toArray();
}

async function updateById(id, updates) {
  const db = getDb();
  return db.collection("experts").updateOne({ _id: new ObjectId(id) }, { $set: updates });
}

async function upsertByCode(code, doc) {
  const db = getDb();
  return db.collection("experts").updateOne({ code }, doc, { upsert: true });
}

async function findOneByCode(code) {
  const db = getDb();
  return db.collection("experts").findOne({ code });
}

async function deleteAll() {
  const db = getDb();
  return db.collection("experts").deleteMany({});
}

async function upsertAndFetch({ code, name, role }) {
  const db = getDb();
  const now = new Date();
  const r = await db.collection("experts").updateOne(
    { code },
    {
      $set: { code, name, role, updatedAt: now },
      $setOnInsert: { competenceK: 1, createdAt: now }
    },
    { upsert: true }
  );
  const doc = await db.collection("experts").findOne({ code });
  return { doc, upserted: Boolean(r.upsertedCount), matched: r.matchedCount ?? 0 };
}

module.exports = {
  listAll,
  updateById,
  upsertByCode,
  findOneByCode,
  deleteAll,
  upsertAndFetch
};
