import { User } from "../models/index.js";
import { verifyToken } from "../utils/token.js";
import { AppError } from "../utils/AppError.js";

// 1. AUTHENTICATION: is there a valid token, and does the user still exist?
export async function protect(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new AppError(401, "Not logged in. Please provide a Bearer token."));
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    const message = err.name === "TokenExpiredError" ? "Session expired. Please log in again." : "Invalid token";
    return next(new AppError(401, message));
  }

  // Load the user fresh from the DB: role, tier and storeId come from here,
  // never from the token or the request body.
  const user = await User.findById(payload.sub);
  if (!user) return next(new AppError(401, "User no longer exists"));
  if (!user.isActive) return next(new AppError(403, "Account is disabled"));

  req.user = user;
  next();
}

// For public routes that behave a little differently for logged-in users.
// Never fails: an invalid or missing token just means "not logged in".
export async function optionalAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme === "Bearer" && token) {
    try {
      const user = await User.findById(verifyToken(token).sub);
      if (user?.isActive) req.user = user;
    } catch {
      /* ignore */
    }
  }
  next();
}

// 2. ROLE CHECK: authorize("admin") or authorize("manager", "admin")
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, "You do not have permission to perform this action"));
    }
    next();
  };
}

// 3. STORE CHECK: managers may only touch their assigned store; admins may touch any.
// Use when the store id is in the URL, e.g. router.get("/:storeId", protect, requireStoreAccess(), ...)
export function requireStoreAccess(paramName = "storeId") {
  return (req, res, next) => {
    try {
      assertStoreAccess(req.user, req.params[paramName]);
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Same checks as plain functions, for use inside controllers once a document is loaded.
export function assertStoreAccess(user, storeId) {
  if (user.role === "admin") return;
  if (user.role === "manager" && user.storeId?.toString() === storeId?.toString()) return;
  throw new AppError(403, "You can only access your assigned store");
}

// 4. OWNERSHIP CHECK: a customer may only see their own orders, cart, etc.
export function assertOwnership(user, ownerId) {
  if (user.role === "admin") return;
  if (user._id.toString() === ownerId?.toString()) return;
  throw new AppError(403, "You can only access your own data");
}
