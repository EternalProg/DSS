const rulesService = require("../services/rulesService");
async function list(req, res) {
  const rules = await rulesService.listRules();
  res.json(rules);
}

async function create(req, res) {
  const r = await rulesService.createRule(req.body);
  res.status(201).json(r);
}

async function update(req, res) {
  const r = await rulesService.updateRule({ id: req.params.id, payload: req.body });
  res.json(r);
}

async function remove(req, res) {
  const r = await rulesService.deleteRule({ id: req.params.id });
  res.json(r);
}

module.exports = {
  list,
  create,
  update,
  remove
};
