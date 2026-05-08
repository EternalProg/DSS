const { getDb } = require("../services/db");

async function deleteAll() {
  const db = getDb();
  return db.collection("expertEvaluations").deleteMany({});
}

async function upsertOne({ expertId, alternativeId, criterionId, value, now }) {
  const db = getDb();
  return db.collection("expertEvaluations").updateOne(
    { expertId, alternativeId, criterionId },
    {
      $set: { value, updatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
}

async function listAll() {
  const db = getDb();
  return db.collection("expertEvaluations").find({}).toArray();
}

module.exports = {
  deleteAll,
  upsertOne,
  listAll
};
