const expertCsvImportService = require("../services/expertCsvImportService");
const { badRequest } = require("../utils/errors");

async function importExpertCsv(req, res) {
  const csvText = req.body;
  if (!csvText || typeof csvText !== "string" || !csvText.trim()) {
    throw badRequest("CSV порожній.", [
      {
        code: "CSV_EMPTY",
        message: "Не отримано вміст CSV.",
        hint: "Надішліть тіло запиту як text/csv або text/plain."
      }
    ]);
  }

  const result = await expertCsvImportService.importExpertCsv({ csvText, mode: "replace" });
  if (!result.ok) {
    // Keep old response shape for the UI.
    return res.status(400).json({
      message: "Імпорт не виконано. Виправте помилки у CSV та спробуйте ще раз.",
      ...result
    });
  }

  return res.json(result);
}

module.exports = { importExpertCsv };
