const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const triadsController = require("../controllers/triadsController");

const router = express.Router();

router.get("/", asyncHandler(triadsController.list));
router.post("/", asyncHandler(triadsController.create));
router.post(
  "/import",
  express.text({
    type: ["text/csv", "text/plain", "application/csv", "application/vnd.ms-excel"],
    limit: "10mb"
  }),
  asyncHandler(triadsController.importCsv)
);

module.exports = router;
