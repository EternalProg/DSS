const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const consensusController = require("../controllers/consensusController");

const router = express.Router();

router.get("/methods", consensusController.methods);
router.post("/calculate", asyncHandler(consensusController.calculate));

module.exports = router;
