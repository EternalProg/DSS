const { connectToDb, getDb } = require("./services/db");
const { createApp } = require("./app");

const app = createApp();
const port = process.env.PORT || 3000;

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
