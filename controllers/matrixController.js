const matrixService = require("../services/matrixService");
async function get(req, res) {
  const data = await matrixService.getMatrix();
  res.json(data);
}

module.exports = { get };
