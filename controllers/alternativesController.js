const alternativesService = require("../services/alternativesService");
async function list(req, res) {
  const alternatives = await alternativesService.listAlternatives();
  res.json(alternatives);
}

async function create(req, res) {
  const r = await alternativesService.createAlternative(req.body ?? {});
  res.status(201).json(r);
}

async function update(req, res) {
  const r = await alternativesService.updateAlternative({ id: req.params.id, ...(req.body ?? {}) });
  res.json(r);
}

async function remove(req, res) {
  const r = await alternativesService.deleteAlternative({ id: req.params.id });
  res.json(r);
}

module.exports = {
  list,
  create,
  update,
  remove
};
