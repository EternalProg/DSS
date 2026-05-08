const { ObjectId } = require("mongodb");
const { getDb } = require("../services/db");

async function listAll() {
  const db = getDb();
  return db.collection("alternatives").find({}).toArray();
}

async function insertOne({ name, description }) {
  const db = getDb();
  const now = new Date();
  const result = await db.collection("alternatives").insertOne({
    name,
    description,
    createdAt: now
  });
  return { _id: result.insertedId };
}

async function updateById(id, { name, description }) {
  const db = getDb();
  const result = await db.collection("alternatives").updateOne(
    { _id: new ObjectId(id) },
    { $set: { name, description, updatedAt: new Date() } }
  );
  return result;
}

async function deleteById(id) {
  const db = getDb();
  return db.collection("alternatives").deleteOne({ _id: new ObjectId(id) });
}

module.exports = {
  listAll,
  insertOne,
  updateById,
  deleteById
};
