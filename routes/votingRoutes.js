const express = require("express");
const votingController = require("../controllers/votingController");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.post(
  "/import",
  express.text({
    type: ["text/csv", "text/plain", "application/csv", "application/vnd.ms-excel"],
    limit: "10mb"
  }),
  asyncHandler(votingController.importCsv)
);

module.exports = router;
