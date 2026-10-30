import { AppError } from "./AppError.js";

// Minimal input validation without extra libraries.
// Usage: requireFields(req.body, ["email", "password"]);
export function requireFields(body, fields) {
  const missing = fields.filter(
    (f) => body?.[f] === undefined || body?.[f] === null || String(body[f]).trim() === ""
  );
  if (missing.length) {
    throw new AppError(400, `Missing required fields: ${missing.join(", ")}`);
  }
}

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new AppError(400, "Password must be at least 8 characters long");
  }
}
