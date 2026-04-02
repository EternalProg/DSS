const path = require("path");
const express = require("express");
const { getDb, connectToDb } = require("./services/db");
const alternativesRouter = require("./routes/alternatives");
const criteriaRouter = require("./routes/criteria");
const evaluationsRouter = require("./routes/evaluations");
const matrixRouter = require("./routes/matrix");
const analyticsRouter = require("./routes/analytics");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/alternatives", alternativesRouter);
app.use("/api/criteria", criteriaRouter);
app.use("/api/evaluations", evaluationsRouter);
app.use("/api/matrix", matrixRouter);
app.use("/api/analytics", analyticsRouter);

connectToDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error.message);
    process.exit(1);
  });

module.exports = { app, getDb };
