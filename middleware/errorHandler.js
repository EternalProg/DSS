const { AppError } = require("../utils/errors");

module.exports = function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  void next;

  if (err instanceof AppError) {
    const payload = { message: err.message };
    if (err.details != null) payload.details = err.details;
    return res.status(err.statusCode).json(payload);
  }

  // Avoid leaking stack traces; log server-side.
  console.error(err);
  return res.status(500).json({ message: err?.message || "Internal server error." });
};
