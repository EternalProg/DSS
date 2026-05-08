const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const rulesController = require("../controllers/rulesController");

const router = express.Router();

router.get("/", asyncHandler(rulesController.list));
router.post("/", asyncHandler(rulesController.create));
router.put("/:id", asyncHandler(rulesController.update));
router.delete("/:id", asyncHandler(rulesController.remove));

module.exports = router;
