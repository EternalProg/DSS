const express = require("express");
const { getDb } = require("../services/db");
const { importExpertCsv } = require("../services/csvImport");

const router = express.Router();

router.post(
  "/csv",
  express.text({
    type: ["text/csv", "text/plain", "application/csv", "application/vnd.ms-excel"],
    limit: "10mb"
  }),
  async (req, res) => {
    const db = getDb();
    const csvText = req.body;

    if (!csvText || typeof csvText !== "string" || !csvText.trim()) {
      return res.status(400).json({
        message: "CSV порожній.",
        errors: [
          {
            code: "CSV_EMPTY",
            message: "Не отримано вміст CSV.",
            hint: "Надішліть тіло запиту як text/csv або text/plain."
          }
        ]
      });
    }

    try {
      const result = await importExpertCsv({ db, csvText, mode: "replace" });
      if (!result.ok) {
        return res.status(400).json({
          message: "Імпорт не виконано. Виправте помилки у CSV та спробуйте ще раз.",
          ...result
        });
      }

      return res.json(result);
    } catch (error) {
      console.error("CSV import error:", error);
      return res.status(500).json({
        message: "Не вдалося імпортувати CSV.",
        errors: [
          {
            code: "IMPORT_FAILED",
            message: error.message || "Internal error",
            hint: "Перевірте, що сервер має доступ до MongoDB та CSV відповідає очікуваному формату."
          }
        ]
      });
    }
  }
);

module.exports = router;
