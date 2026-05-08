const expertsService = require("../services/expertsService");
async function list(req, res) {
  const experts = await expertsService.listExperts();
  res.json(experts);
}

async function update(req, res) {
  const body = req.body ?? {};
  const hasCompetenceKField = Object.prototype.hasOwnProperty.call(body, "competenceK");
  const hasPsychTypeField = Object.prototype.hasOwnProperty.call(body, "psychType");
  const r = await expertsService.updateExpert({
    id: req.params.id,
    competenceK: body.competenceK,
    psychType: body.psychType,
    hasCompetenceKField,
    hasPsychTypeField
  });
  res.json(r);
}

module.exports = {
  list,
  update
};
