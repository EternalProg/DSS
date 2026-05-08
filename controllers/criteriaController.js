const criteriaService = require("../services/criteriaService");
async function list(req, res) {
  const criteria = await criteriaService.listCriteria();
  res.json(criteria);
}

async function create(req, res) {
  const r = await criteriaService.createCriterion(req.body ?? {});
  res.status(201).json(r);
}

async function update(req, res) {
  const hasCodeField = Object.prototype.hasOwnProperty.call(req.body ?? {}, "code");
  const r = await criteriaService.updateCriterion({ id: req.params.id, hasCodeField, ...(req.body ?? {}) });
  res.json(r);
}

async function updateWeight(req, res) {
  const r = await criteriaService.updateCriterionWeight({ id: req.params.id, weight: req.body?.weight });
  res.json(r);
}

async function updateThreshold(req, res) {
  const r = await criteriaService.updateCriterionThreshold({ id: req.params.id, ...(req.body ?? {}) });
  res.json(r);
}

async function remove(req, res) {
  const r = await criteriaService.deleteCriterion({ id: req.params.id });
  res.json(r);
}

module.exports = {
  list,
  create,
  update,
  updateWeight,
  updateThreshold,
  remove
};
