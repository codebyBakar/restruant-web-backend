const logger = require("../utils/logger");

const notFound = (req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found" });
};

// Map known database/mongoose errors to safe, generic messages.
// Full error details are always logged server-side (see logger).
const mapKnownError = (err) => {
  if (err.name === "CastError") {
    return { statusCode: 404, message: "Resource not found" };
  }
  if (err.code === 11000) {
    return { statusCode: 400, message: "A record with this value already exists" };
  }
  if (err.name === "ValidationError") {
    return { statusCode: 400, message: "Invalid data provided" };
  }
  return null;
};

const errorHandler = (err, req, res, next) => {
  logger.error(req, err);

  // App-thrown errors with an explicit 4xx status carry an intentional,
  // client-safe message (e.g. "Email already registered").
  const intentional = err.statusCode && err.statusCode >= 400 && err.statusCode < 500;

  const known = mapKnownError(err);

  let statusCode = err.statusCode || 500;
  let message;

  if (known) {
    statusCode = known.statusCode;
    message = known.message;
  } else if (intentional) {
    message = err.message || "Request failed";
  } else if (statusCode >= 400 && statusCode < 500) {
    message = err.message || "Request failed";
  } else {
    statusCode = 500;
    message = "Internal server error. Please try again later.";
  }

  res.status(statusCode).json({ success: false, message });
};

module.exports = { notFound, errorHandler };
