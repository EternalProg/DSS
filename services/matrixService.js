const alternativesRepo = require("../data/alternativesRepo");
const criteriaRepo = require("../data/criteriaRepo");
const evaluationsRepo = require("../data/evaluationsRepo");

async function getMatrix() {
  const [alternatives, criteria, evaluations] = await Promise.all([
    alternativesRepo.listAll(),
    criteriaRepo.listAll(),
    evaluationsRepo.listAll()
  ]);

  const evaluationMap = new Map();
  evaluations.forEach((evaluation) => {
    evaluationMap.set(
      `${evaluation.alternativeId.toString()}-${evaluation.criterionId.toString()}`,
      evaluation
    );
  });

  const rows = alternatives.map((alternative) => {
    const cells = criteria.map((criterion) => {
      const key = `${alternative._id.toString()}-${criterion._id.toString()}`;
      const evaluation = evaluationMap.get(key);
      return {
        criterionId: criterion._id,
        value: evaluation ? evaluation.value : null,
        evaluationId: evaluation ? evaluation._id : null
      };
    });

    return {
      alternativeId: alternative._id,
      alternativeName: alternative.name,
      values: cells
    };
  });

  return { alternatives, criteria, rows };
}

module.exports = { getMatrix };
