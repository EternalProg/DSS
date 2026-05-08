const express = require("express");
const importController = require("../controllers/importController");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.post(
  "/csv",
  express.text({
    type: ["text/csv", "text/plain", "application/csv", "application/vnd.ms-excel"],
    limit: "10mb"
  }),
  asyncHandler(importController.importExpertCsv)
);

module.exports = router;
