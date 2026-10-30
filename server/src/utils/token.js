import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const TOKEN_EXPIRY = "12h";

// The token only carries the user id and role. Everything else (tier, store,
// active status) is re-read from the database on every request, so a stale
// or tampered token can't grant extra access.
export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: TOKEN_EXPIRY,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret); // throws if invalid or expired
}
