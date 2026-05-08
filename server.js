const path = require("path");
const express = require("express");
const { getDb, connectToDb } = require("./services/db");
const alternativesRouter = require("./routes/alternativesRoutes");
const criteriaRouter = require("./routes/criteriaRoutes");
const evaluationsRouter = require("./routes/evaluationsRoutes");
const matrixRouter = require("./routes/matrixRoutes");
const analyticsRouter = require("./routes/analyticsRoutes");
const importRouter = require("./routes/importRoutes");
const consensusRouter = require("./routes/consensusRoutes");
const expertsRouter = require("./routes/expertsRoutes");
const triadsRouter = require("./routes/triadsRoutes");
const rulesRouter = require("./routes/rulesRoutes");
const votingRouter = require("./routes/votingRoutes");

const errorHandler = require("./middleware/errorHandler");

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
app.use("/api/import", importRouter);
app.use("/api/consensus", consensusRouter);
app.use("/api/experts", expertsRouter);
app.use("/api/triads", triadsRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/voting", votingRouter);

app.use(errorHandler);

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
