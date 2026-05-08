const evaluationsService = require("../services/evaluationsService");
async function list(req, res) {
  const evaluations = await evaluationsService.listEvaluations();
  res.json(evaluations);
}

async function upsert(req, res) {
  const { created, _id } = await evaluationsService.upsertEvaluation(req.body ?? {});
  if (created) return res.status(201).json({ _id });
  return res.json({ message: "Evaluation updated." });
}

async function updateById(req, res) {
  const r = await evaluationsService.updateEvaluationById({ id: req.params.id, value: req.body?.value });
  res.json(r);
}

module.exports = {
  list,
  upsert,
  updateById
};
