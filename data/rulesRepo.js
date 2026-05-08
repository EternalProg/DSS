const { ObjectId } = require("mongodb");
const { getDb } = require("../services/db");

async function listAll() {
  const db = getDb();
  return db.collection("rules").find({}).sort({ createdAt: -1 }).toArray();
}

async function insertOne(doc) {
  const db = getDb();
  const result = await db.collection("rules").insertOne(doc);
  return { _id: result.insertedId };
}

async function updateById(id, setDoc) {
  const db = getDb();
  return db.collection("rules").updateOne({ _id: new ObjectId(id) }, { $set: setDoc });
}

async function deleteById(id) {
  const db = getDb();
  return db.collection("rules").deleteOne({ _id: new ObjectId(id) });
}

module.exports = {
  listAll,
  insertOne,
  updateById,
  deleteById
};
