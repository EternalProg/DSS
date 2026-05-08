const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const evaluationsController = require("../controllers/evaluationsController");

const router = express.Router();

router.get("/", asyncHandler(evaluationsController.list));
router.post("/", asyncHandler(evaluationsController.upsert));
router.put("/:id", asyncHandler(evaluationsController.updateById));

module.exports = router;
