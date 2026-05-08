const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const alternativesController = require("../controllers/alternativesController");

const router = express.Router();

router.get("/", asyncHandler(alternativesController.list));
router.post("/", asyncHandler(alternativesController.create));
router.put("/:id", asyncHandler(alternativesController.update));
router.delete("/:id", asyncHandler(alternativesController.remove));

module.exports = router;
