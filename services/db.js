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
      .collection("evaluations")
      .createIndex({ alternativeId: 1, criterionId: 1 }, { unique: true })
  ]);

  return db;
}

function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call connectToDb first.");
  }
  return db;
}

module.exports = {
  connectToDb,
  getDb
};
