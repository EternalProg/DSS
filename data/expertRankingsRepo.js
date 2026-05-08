const { getDb } = require("../services/db");

async function deleteAll() {
  const db = getDb();
  return db.collection("expertRankings").deleteMany({});
}

async function upsertOne({ expertId, alternativeId, rank, now }) {
  const db = getDb();
  return db.collection("expertRankings").updateOne(
    { expertId, alternativeId },
    { $set: { rank, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
}

module.exports = {
  deleteAll,
  upsertOne
};
