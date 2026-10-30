import { PolicyDocument, PolicyChunk } from "../../models/index.js";
import { AppError } from "../../utils/AppError.js";
import { chunkDocument } from "./chunker.js";
import { embedText } from "./embeddings.js";

// Upload -> chunk -> embed -> store. The document and its chunks stay "pending"
// (invisible to the assistant) until an admin approves them.
export async function ingestDocument({ title, fileName, text, appliesToTiers, uploadedBy }) {
  if (!text || text.trim().length < 20) throw new AppError(400, "Document has no readable text");

  const chunks = chunkDocument(text, { title, fileName });
  if (!chunks.length) throw new AppError(400, "No usable text sections found in the document");

  // New upload of an existing title = next version.
  const latest = await PolicyDocument.findOne({ title }).sort({ version: -1 });
  const version = latest ? latest.version + 1 : 1;

  const doc = await PolicyDocument.create({
    title, version, fileName, appliesToTiers, uploadedBy, status: "pending",
  });

  try {
    const rows = [];
    for (const chunk of chunks) {
      rows.push({
        documentId: doc._id,
        text: chunk.text,
        embedding: await embedText(chunk.text),
        metadata: {
          status: "pending",
          appliesToTiers: doc.appliesToTiers,
          version,
          source: title,
          section: chunk.section,
          chunkIndex: chunk.chunkIndex,
        },
      });
    }
    await PolicyChunk.insertMany(rows);
    doc.chunkCount = rows.length;
    await doc.save();
    return doc;
  } catch (err) {
    // Don't leave a half-ingested document behind.
    await PolicyChunk.deleteMany({ documentId: doc._id });
    await PolicyDocument.deleteOne({ _id: doc._id });
    throw new AppError(502, `Could not embed the document: ${err.message}`);
  }
}

// Approve a version. Older approved versions of the same title are archived,
// so the assistant only ever answers from the current version.
export async function approveDocument(documentId, adminId) {
  const doc = await PolicyDocument.findById(documentId);
  if (!doc) throw new AppError(404, "Policy document not found");
  if (doc.status !== "pending") throw new AppError(400, `Only pending documents can be approved (current: ${doc.status})`);

  const older = await PolicyDocument.find({ title: doc.title, status: "approved", _id: { $ne: doc._id } }, "_id");
  if (older.length) {
    const ids = older.map((d) => d._id);
    await PolicyDocument.updateMany({ _id: { $in: ids } }, { $set: { status: "archived" } });
    await PolicyChunk.updateMany({ documentId: { $in: ids } }, { $set: { "metadata.status": "archived" } });
  }

  doc.status = "approved";
  doc.approvedBy = adminId;
  doc.approvedAt = new Date();
  await doc.save();
  await PolicyChunk.updateMany({ documentId: doc._id }, { $set: { "metadata.status": "approved" } });
  return { doc, archivedVersions: older.length };
}

export async function rejectDocument(documentId) {
  const doc = await PolicyDocument.findById(documentId);
  if (!doc) throw new AppError(404, "Policy document not found");
  if (doc.status !== "pending") throw new AppError(400, "Only pending documents can be rejected");
  doc.status = "rejected";
  await doc.save();
  await PolicyChunk.updateMany({ documentId: doc._id }, { $set: { "metadata.status": "rejected" } });
  return doc;
}

// Membership applicability: change which tiers a policy applies to (doc + all its chunks).
export async function updateDocumentTiers(documentId, tiers) {
  const doc = await PolicyDocument.findById(documentId);
  if (!doc) throw new AppError(404, "Policy document not found");
  doc.appliesToTiers = tiers;
  await doc.save(); // runs enum + "at least one tier" validation
  await PolicyChunk.updateMany({ documentId: doc._id }, { $set: { "metadata.appliesToTiers": doc.appliesToTiers } });
  return doc;
}
