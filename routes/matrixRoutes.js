const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const matrixController = require("../controllers/matrixController");

const router = express.Router();

router.get("/", asyncHandler(matrixController.get));

module.exports = router;
