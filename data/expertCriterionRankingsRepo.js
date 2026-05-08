const { getDb } = require("../services/db");

async function deleteAll() {
  const db = getDb();
  return db.collection("expertCriterionRankings").deleteMany({});
}

async function upsertOne({ expertId, criterionId, rank, now }) {
  const db = getDb();
  return db.collection("expertCriterionRankings").updateOne(
    { expertId, criterionId },
    { $set: { rank, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
}

module.exports = { deleteAll, upsertOne };
