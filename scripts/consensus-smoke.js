/* eslint-disable no-console */

const { connectToDb, getDb, closeDb } = require("../services/db");
const consensus = require("../services/consensus");

async function main() {
  await connectToDb();
  const db = getDb();

  try {
    const [experts, expertEvaluations] = await Promise.all([
      db.collection("experts").find({}).toArray(),
      db.collection("expertEvaluations").find({}).toArray()
    ]);

    console.log("Experts:", experts.length);
    console.log("Expert evaluations:", expertEvaluations.length);

    if (experts.length && expertEvaluations.length) {
      const e7u = consensus.calculateE7Matrix({
        experts,
        expertEvaluations,
        variant: "utilitarian"
      });
      const e7e = consensus.calculateE7Matrix({
        experts,
        expertEvaluations,
        variant: "egalitarian"
      });
      const e1 = consensus.calculateE1Matrix({ experts, expertEvaluations });
      console.log("E7 utilitarian cells:", e7u.cells.length);
      console.log("E7 egalitarian cells:", e7e.cells.length);
      console.log("E1 cells:", e1.cells.length);
      if (e1.cells[0]) console.log("E1 sample cell meta:", e1.cells[0].meta);
    }

    const triads = await db.collection("expertTriads").find({}).toArray();
    if (experts.length && triads.length) {
      const e2 = consensus.calculateE2Matrix({ experts, expertTriads: triads, p: 0.05 });
      console.log("E2 cells:", e2.cells.length);
      if (e2.cells[0]) console.log("E2 sample cell meta:", e2.cells[0].meta);
    }
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
