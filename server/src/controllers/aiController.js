import multer from "multer";
import path from "path";
import { PolicyDocument } from "../models/index.js";
import { AppError } from "../utils/AppError.js";
import { logAudit } from "../utils/audit.js";
import { TIERS } from "../utils/constants.js";
import { recommendProducts } from "../services/ai/recommendations.js";
import { getRestockSuggestions } from "../services/ai/restock.js";
import { answerPolicyQuestion } from "../services/rag/policyAssistant.js";
import { ingestDocument, approveDocument, rejectDocument, updateDocumentTiers } from "../services/rag/ingest.js";

// ---------- AI features ----------

// POST /api/ai/recommendations { budget, categoryId?, preferences?, storeId }
export async function recommendations(req, res) {
  const result = await recommendProducts(req.body);
  res.json({ success: true, ...result });
}

// POST /api/ai/chat { question }  — tier always comes from the DB user, never the request.
// Admins may preview as a tier with { tier } to test policy filtering.
export async function chat(req, res) {
  const question = String(req.body.question || "").trim();
  if (question.length < 3) throw new AppError(400, "Please type a question");
  if (question.length > 500) throw new AppError(400, "Question is too long (max 500 characters)");

  const tier = req.user.role === "admin" && TIERS.includes(req.body.tier) ? req.body.tier : req.user.tier;
  const result = await answerPolicyQuestion(question, tier);
  res.json({ success: true, tier, ...result });
}

// POST /api/ai/restock-suggestions { storeId (admin only) }
export async function restockSuggestions(req, res) {
  const storeId = req.user.role === "manager" ? req.user.storeId : req.body.storeId;
  if (!storeId) throw new AppError(400, "storeId is required");
  const result = await getRestockSuggestions(storeId);
  res.json({ success: true, ...result });
}

// ---------- Policy documents (admin) ----------

const ALLOWED_EXT = [".md", ".txt", ".json"];
const MAX_UPLOAD_MB = 4;

// Multer keeps the file in memory (no disk writes needed: we only read its text).
export const uploadPolicyFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.includes(ext)) cb(null, true);
    else cb(new AppError(400, `Only ${ALLOWED_EXT.join(", ")} files are supported (text-based documents)`));
  },
}).single("file");

function parseTiers(value) {
  if (!value) return [...TIERS];
  const tiers = (Array.isArray(value) ? value : String(value).split(","))
    .map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!tiers.length || !tiers.every((t) => TIERS.includes(t))) throw new AppError(400, `Tiers must be from: ${TIERS.join(", ")}`);
  return [...new Set(tiers)];
}

// POST /api/admin/policies  (multipart: file, title, appliesToTiers)
export async function uploadPolicy(req, res) {
  if (!req.file) throw new AppError(400, "Please attach a policy file");
  const title = String(req.body.title || "").trim();
  if (!title) throw new AppError(400, "Title is required");

  const doc = await ingestDocument({
    title,
    fileName: req.file.originalname,
    text: req.file.buffer.toString("utf8"),
    appliesToTiers: parseTiers(req.body.appliesToTiers),
    uploadedBy: req.user._id,
  });
  await logAudit(req.user._id, "POLICY_UPLOADED", "PolicyDocument", doc._id, { title, version: doc.version, chunks: doc.chunkCount });
  res.status(201).json({ success: true, message: "Uploaded. The document stays pending until approved.", document: doc });
}

// GET /api/admin/policies?status=
export async function listPolicies(req, res) {
  const filter = req.query.status ? { status: req.query.status } : {};
  const documents = await PolicyDocument.find(filter)
    .populate("uploadedBy", "name").populate("approvedBy", "name")
    .sort({ title: 1, version: -1 });
  res.json({ success: true, documents });
}

// PATCH /api/admin/policies/:id/approve
export async function approvePolicy(req, res) {
  const { doc, archivedVersions } = await approveDocument(req.params.id, req.user._id);
  await logAudit(req.user._id, "POLICY_APPROVED", "PolicyDocument", doc._id, { title: doc.title, version: doc.version, archivedVersions });
  res.json({ success: true, document: doc, archivedVersions });
}

// PATCH /api/admin/policies/:id/reject
export async function rejectPolicy(req, res) {
  const doc = await rejectDocument(req.params.id);
  await logAudit(req.user._id, "POLICY_REJECTED", "PolicyDocument", doc._id, { title: doc.title, version: doc.version });
  res.json({ success: true, document: doc });
}

// PATCH /api/admin/policies/:id/tiers { appliesToTiers: ["gold"] }
export async function updatePolicyTiers(req, res) {
  const doc = await updateDocumentTiers(req.params.id, parseTiers(req.body.appliesToTiers));
  await logAudit(req.user._id, "POLICY_TIERS_UPDATED", "PolicyDocument", doc._id, { appliesToTiers: doc.appliesToTiers });
  res.json({ success: true, document: doc });
}
