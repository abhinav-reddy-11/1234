import bcrypt from "bcrypt";
import { User } from "../models/index.js";
import { signToken } from "../utils/token.js";
import { AppError } from "../utils/AppError.js";
import { requireFields, validatePassword } from "../utils/validate.js";
import { logAudit } from "../utils/audit.js";

const SALT_ROUNDS = 10;

// POST /api/auth/register  — public sign-up creates CUSTOMERS only.
// Managers and admins are created by an admin (or the seed script), never self-registered.
export async function register(req, res) {
  requireFields(req.body, ["name", "email", "password"]);
  const { name, email, password } = req.body;
  validatePassword(password);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // role, tier and spend are NOT taken from req.body, so nobody can sign up as admin or gold.
  const user = await User.create({ name, email, passwordHash, role: "customer" });

  await logAudit(user._id, "USER_REGISTERED", "User", user._id);

  res.status(201).json({ success: true, token: signToken(user), user });
}

// POST /api/auth/login
export async function login(req, res) {
  requireFields(req.body, ["email", "password"]);
  const { email, password } = req.body;

  // passwordHash has select:false, so ask for it explicitly here.
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+passwordHash");

  // Same message for "no such user" and "wrong password", so attackers can't probe emails.
  const passwordOk = user && (await bcrypt.compare(password, user.passwordHash));
  if (!passwordOk) throw new AppError(401, "Invalid email or password");
  if (!user.isActive) throw new AppError(403, "Account is disabled");

  await user.populate("storeId", "name city"); // managers see their store name right away
  res.json({ success: true, token: signToken(user), user });
}

// GET /api/auth/me  — returns the logged-in user (with store details for managers).
export async function getMe(req, res) {
  const user = await User.findById(req.user._id).populate("storeId", "name city");
  res.json({ success: true, user });
}
