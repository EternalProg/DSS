const { MongoClient } = require("mongodb");

const mongoUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGO_DB || "learning_platform_selection";

let db;
let client;

async function connectToDb() {
  if (db) {
    return db;
  }

  client = new MongoClient(mongoUrl);
  await client.connect();
  db = client.db(dbName);

  await Promise.all([
    db.collection("alternatives").createIndex({ name: 1 }, { unique: true }),
    db.collection("criteria").createIndex({ name: 1 }, { unique: true }),
    db
      .collection("criteria")
      .createIndex({ code: 1 }, { unique: true, sparse: true }),
    db.collection("experts").createIndex({ code: 1 }, { unique: true }),
    db
      .collection("evaluations")
      .createIndex({ alternativeId: 1, criterionId: 1 }, { unique: true }),
    db
      .collection("expertEvaluations")
      .createIndex(
        { expertId: 1, alternativeId: 1, criterionId: 1 },
        { unique: true }
      ),
    db
      .collection("expertRankings")
      .createIndex({ expertId: 1, alternativeId: 1 }, { unique: true })
    ,
    db
      .collection("expertTriads")
      .createIndex(
        { expertId: 1, alternativeId: 1, criterionId: 1 },
        { unique: true }
      )
    ,
    db.collection("rules").createIndex({ createdAt: -1 })
    ,
    db
      .collection("expertCriterionRankings")
      .createIndex({ expertId: 1, criterionId: 1 }, { unique: true })
  ]);

  return db;
}

function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call connectToDb first.");
  }
  return db;
}

async function closeDb() {
  if (client) {
    await client.close();
  }
  client = null;
  db = null;
}

module.exports = {
  connectToDb,
  getDb,
  closeDb
};
