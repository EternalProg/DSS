const path = require("path");
const fs = require("fs");
const express = require("express");

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

function createApp() {
  const app = express();

  app.use(express.json());

  // Static frontend:
  // - in dev, Vite serves UI separately, but backend can still serve /public.
  // - after `vite build`, serve /dist.
  const distDir = path.join(__dirname, "dist");
  const publicDir = path.join(__dirname, "public");
  const staticDir = fs.existsSync(distDir) ? distDir : publicDir;
  app.use(express.static(staticDir));

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

  // SPA fallback (avoid touching API paths)
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    const indexPath = path.join(staticDir, "index.html");
    return res.sendFile(indexPath);
  });

  return app;
}

module.exports = { createApp };
