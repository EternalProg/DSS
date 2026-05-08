const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const analyticsController = require("../controllers/analyticsController");

const router = express.Router();

router.get("/", analyticsController.status);
router.post("/calculate", asyncHandler(analyticsController.calculate));

module.exports = router;
