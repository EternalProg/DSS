const { getDb } = require("../services/db");

async function deleteAll() {
  const db = getDb();
  return db.collection("expertTriads").deleteMany({});
}

async function listAll() {
  const db = getDb();
  return db.collection("expertTriads").find({}).toArray();
}

async function bulkWrite(ops, options) {
  const db = getDb();
  return db.collection("expertTriads").bulkWrite(ops, options);
}

async function upsertOne({ expertId, alternativeId, criterionId, optimistic, realistic, pessimistic, now }) {
  const db = getDb();
  return db.collection("expertTriads").updateOne(
    { expertId, alternativeId, criterionId },
    {
      $set: { optimistic, realistic, pessimistic, updatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
}

module.exports = {
  deleteAll,
  listAll,
  bulkWrite,
  upsertOne
};
