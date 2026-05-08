const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const criteriaController = require("../controllers/criteriaController");

const router = express.Router();

router.get("/", asyncHandler(criteriaController.list));
router.post("/", asyncHandler(criteriaController.create));
router.put("/:id", asyncHandler(criteriaController.update));
router.patch("/:id/weight", asyncHandler(criteriaController.updateWeight));
router.patch("/:id/threshold", asyncHandler(criteriaController.updateThreshold));
router.delete("/:id", asyncHandler(criteriaController.remove));

module.exports = router;
