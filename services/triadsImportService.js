const { ObjectId } = require("mongodb");
const { parseCsv } = require("./csv");
const expertsRepo = require("../data/expertsRepo");
const alternativesRepo = require("../data/alternativesRepo");
const criteriaRepo = require("../data/criteriaRepo");
const expertTriadsRepo = require("../data/expertTriadsRepo");

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[_-]/g, " ");
}

function getCell(row, idx) {
  if (!row || idx == null) return "";
  return String(row[idx] ?? "").trim();
}

function makeImportError(code, message, hint) {
  return { code, message, hint };
}

async function importTriadsCsv({ csvText, mode = "replace" } = {}) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      ok: false,
      message: "CSV-файл не містить даних.",
      errors: [
        makeImportError(
          "CSV_EMPTY",
          "Потрібен рядок заголовків + хоча б 1 рядок даних.",
          "Експортуйте таблицю у CSV і завантажте отриманий файл."
        )
      ]
    };
  }

  const headers = rows[0].map(normalizeHeader);
  const headerIndex = new Map(headers.map((h, i) => [h, i]));

  const idxExpert = ["код експерта", "expert", "expert code", "e"].map(normalizeHeader).find((h) => headerIndex.has(h)) ?? null;
  const idxAltName = ["альтернатива", "alternative", "alternative name"].map(normalizeHeader).find((h) => headerIndex.has(h)) ?? null;
  const idxAltId = ["alternativeid", "alternative id", "alt id"].map(normalizeHeader).find((h) => headerIndex.has(h)) ?? null;
  const idxCritCode = ["критерій", "criterion", "criterion code", "код критерію", "c"].map(normalizeHeader).find((h) => headerIndex.has(h)) ?? null;
  const idxCritId = ["criterionid", "criterion id"].map(normalizeHeader).find((h) => headerIndex.has(h)) ?? null;
  const idxO = ["optimistic", "оптимістичний", "opt"].map(normalizeHeader).find((h) => headerIndex.has(h)) ?? null;
  const idxR = ["realistic", "реалістичний", "real"].map(normalizeHeader).find((h) => headerIndex.has(h)) ?? null;
  const idxP = ["pessimistic", "песимістичний", "pes"].map(normalizeHeader).find((h) => headerIndex.has(h)) ?? null;

  const requiredMissing = [];
  if (idxExpert == null) requiredMissing.push("Код експерта");
  if (idxAltName == null && idxAltId == null) requiredMissing.push("Альтернатива (name або id)");
  if (idxCritCode == null && idxCritId == null) requiredMissing.push("Критерій (code або id)");
  if (idxO == null) requiredMissing.push("optimistic");
  if (idxR == null) requiredMissing.push("realistic");
  if (idxP == null) requiredMissing.push("pessimistic");
  if (requiredMissing.length) {
    return {
      ok: false,
      message: "Некоректний CSV для тріад (E2).",
      errors: [
        makeImportError(
          "CSV_BAD_HEADERS",
          `Не знайдено обов'язкові колонки: ${requiredMissing.join(", ")}.`,
          "Очікуваний формат: expert, alternative, criterion, optimistic, realistic, pessimistic."
        )
      ]
    };
  }

  const [experts, alternatives, criteria] = await Promise.all([
    expertsRepo.listAll(),
    alternativesRepo.listAll(),
    criteriaRepo.listAll()
  ]);
  const expertsByCode = new Map(experts.map((e) => [String(e.code).trim().toUpperCase(), e]));
  const alternativesByName = new Map(alternatives.map((a) => [String(a.name).trim(), a]));
  const alternativesById = new Map(alternatives.map((a) => [String(a._id), a]));
  const criteriaByCode = new Map(criteria.map((c) => [String(c.code ?? "").trim().toUpperCase(), c]));
  const criteriaById = new Map(criteria.map((c) => [String(c._id), c]));

  const errors = [];
  const ops = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const expertCodeRaw = getCell(row, headerIndex.get(idxExpert));
    const expertCode = String(expertCodeRaw).trim().toUpperCase();
    if (!expertCode) {
      errors.push(
        makeImportError("ROW_MISSING_EXPERT", `Рядок ${r + 1}: порожній код експерта.`, "Заповніть колонку 'Код експерта' (E1..E7).")
      );
      continue;
    }

    const expert = expertsByCode.get(expertCode);
    if (!expert) {
      errors.push(
        makeImportError(
          "EXPERT_NOT_FOUND",
          `Рядок ${r + 1}: експерт не знайдений: "${expertCode}".`,
          "Спочатку імпортуйте CSV з експертами (Екран 1) або створіть експерта."
        )
      );
      continue;
    }

    let alternative = null;
    if (idxAltId != null) {
      const altIdRaw = getCell(row, headerIndex.get(idxAltId));
      if (!ObjectId.isValid(altIdRaw)) {
        errors.push(
          makeImportError(
            "ALT_ID_INVALID",
            `Рядок ${r + 1}: некоректний alternativeId: "${altIdRaw}".`,
            "Вкажіть existing ObjectId або використайте колонку alternative (назва)."
          )
        );
        continue;
      }
      alternative = alternativesById.get(String(altIdRaw)) ?? null;
    } else {
      const altName = getCell(row, headerIndex.get(idxAltName));
      alternative = alternativesByName.get(altName) ?? null;
    }
    if (!alternative) {
      errors.push(makeImportError("ALT_NOT_FOUND", `Рядок ${r + 1}: альтернатива не знайдена.`, "Перевірте назву альтернативи або використайте alternativeId."));
      continue;
    }

    let criterion = null;
    if (idxCritId != null) {
      const critIdRaw = getCell(row, headerIndex.get(idxCritId));
      if (!ObjectId.isValid(critIdRaw)) {
        errors.push(
          makeImportError(
            "CRIT_ID_INVALID",
            `Рядок ${r + 1}: некоректний criterionId: "${critIdRaw}".`,
            "Вкажіть existing ObjectId або використайте колонку criterion (наприклад C1)."
          )
        );
        continue;
      }
      criterion = criteriaById.get(String(critIdRaw)) ?? null;
    } else {
      const code = getCell(row, headerIndex.get(idxCritCode)).replace(/\s+/g, "");
      const critCode = String(code).trim().toUpperCase();
      criterion = criteriaByCode.get(critCode) ?? null;
    }
    if (!criterion) {
      errors.push(makeImportError("CRIT_NOT_FOUND", `Рядок ${r + 1}: критерій не знайдений.`, "Перевірте criterion (C1..C6) або використайте criterionId."));
      continue;
    }

    const oRaw = getCell(row, headerIndex.get(idxO));
    const rRaw = getCell(row, headerIndex.get(idxR));
    const pRaw = getCell(row, headerIndex.get(idxP));
    const o = Number(String(oRaw).replace(",", "."));
    const rr = Number(String(rRaw).replace(",", "."));
    const ppp = Number(String(pRaw).replace(",", "."));
    if (!Number.isFinite(o) || !Number.isFinite(rr) || !Number.isFinite(ppp)) {
      errors.push(makeImportError("TRIAD_INVALID", `Рядок ${r + 1}: optimistic/realistic/pessimistic мають бути числами.`, "Вкажіть числові значення (наприклад 2, 5, 9)."));
      continue;
    }
    if (!(o <= rr && rr <= ppp)) {
      errors.push(makeImportError("TRIAD_ORDER", `Рядок ${r + 1}: має виконуватись optimistic <= realistic <= pessimistic.`, "Виправте тріаду так, щоб значення були у правильному порядку."));
      continue;
    }

    const now = new Date();
    ops.push({
      updateOne: {
        filter: { expertId: expert._id, alternativeId: alternative._id, criterionId: criterion._id },
        update: { $set: { optimistic: o, realistic: rr, pessimistic: ppp, updatedAt: now }, $setOnInsert: { createdAt: now } },
        upsert: true
      }
    });
  }

  if (errors.length) {
    return {
      ok: false,
      message: "Імпорт тріад (E2) не виконано. Виправте помилки у CSV та спробуйте ще раз.",
      errors: errors.slice(0, 50),
      meta: { totalErrors: errors.length }
    };
  }
  if (!ops.length) {
    return {
      ok: false,
      message: "У CSV немає валідних рядків тріад.",
      errors: [makeImportError("NO_DATA", "Не знайдено жодної валідної тріади.", "Перевірте CSV.")]
    };
  }

  if (mode === "replace") {
    await expertTriadsRepo.deleteAll();
  }
  const wr = await expertTriadsRepo.bulkWrite(ops, { ordered: false });
  const triadsUpserted = (wr.upsertedCount ?? 0) + (wr.modifiedCount ?? 0);

  return {
    ok: true,
    imported: { triads: ops.length, upsertedOrModified: triadsUpserted }
  };
}

module.exports = { importTriadsCsv };
