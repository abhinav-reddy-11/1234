import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

// Every error response has the same shape: { success: false, message, details? }

export function notFound(req, res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Mongoose schema validation failed -> 400
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      details: Object.values(err.errors).map((e) => e.message),
    });
  }
  // File upload problems (Multer), e.g. file too large -> 400
  if (err.name === "MulterError") {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 4 MB)" : err.message;
    return res.status(400).json({ success: false, message });
  }
  // Invalid MongoDB ObjectId in the URL/body -> 400
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}` });
  }
  // Unique index violated (e.g. email already registered) -> 409
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: `${Object.keys(err.keyValue).join(", ")} already exists`,
    });
  }

  const status = err instanceof AppError ? err.statusCode : 500;
  if (status === 500) console.error(err); // only unexpected errors are logged

  res.status(status).json({
    success: false,
    message: status === 500 ? "Internal server error" : err.message,
    ...(err.details && { details: err.details }),
    ...(env.nodeEnv === "development" && status === 500 && { stack: err.stack }),
  });
}
