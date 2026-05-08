const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const expertsController = require("../controllers/expertsController");

const router = express.Router();

router.get("/", asyncHandler(expertsController.list));
router.patch("/:id", asyncHandler(expertsController.update));

module.exports = router;
