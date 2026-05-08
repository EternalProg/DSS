const triadsService = require("../services/triadsService");
const triadsImportService = require("../services/triadsImportService");
const { badRequest } = require("../utils/errors");

async function list(req, res) {
  const triads = await triadsService.listTriads();
  res.json(triads);
}

async function create(req, res) {
  const { created, _id } = await triadsService.saveTriad(req.body ?? {});
  if (created) return res.status(201).json({ _id });
  return res.json({ message: "Triad saved." });
}

async function importCsv(req, res) {
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

  const result = await triadsImportService.importTriadsCsv({ csvText, mode: "replace" });
  if (!result.ok) return res.status(400).json(result);
  return res.json(result);
}

module.exports = {
  list,
  create,
  importCsv
};
