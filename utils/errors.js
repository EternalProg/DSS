class AppError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function badRequest(message, details = null) {
  return new AppError(400, message, details);
}

function notFound(message, details = null) {
  return new AppError(404, message, details);
}

function conflict(message, details = null) {
  return new AppError(409, message, details);
}

function isMongoDuplicateKeyError(error) {
  return Boolean(error && typeof error === "object" && error.code === 11000);
}

function sendError(res, error) {
  if (error instanceof AppError) {
    const payload = { message: error.message };
    if (error.details != null) payload.details = error.details;
    return res.status(error.statusCode).json(payload);
  }

  // Fallback
  return res.status(500).json({ message: error?.message || "Internal server error." });
}

module.exports = {
  AppError,
  badRequest,
  notFound,
  conflict,
  isMongoDuplicateKeyError,
  sendError
};
