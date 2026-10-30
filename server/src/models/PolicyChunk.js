import mongoose from "mongoose";
import { TIERS, POLICY_STATUS, EMBEDDING_DIMENSIONS } from "../utils/constants.js";

// One chunk of a policy document plus its embedding.
// Metadata is copied from the parent document so Atlas Vector Search can filter
// by status and tier without a join.
const policyChunkSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "PolicyDocument", required: true },
    text: { type: String, required: true },
    embedding: {
      type: [Number],
      required: true,
      validate: [
        (v) => v.length === EMBEDDING_DIMENSIONS,
        `Embedding must have exactly ${EMBEDDING_DIMENSIONS} dimensions`,
      ],
    },
    metadata: {
      status: { type: String, enum: POLICY_STATUS, default: "pending" },
      appliesToTiers: [{ type: String, enum: TIERS }],
      version: { type: Number, required: true },
      source: { type: String, required: true }, // document title shown in citations
      section: { type: String }, // heading the chunk came from, shown in citations
      page: { type: Number }, // when available (paged documents)
      chunkIndex: { type: Number, required: true },
    },
  },
  { timestamps: true }
);

policyChunkSchema.index({ documentId: 1, "metadata.chunkIndex": 1 });
// NOTE: the vector index ("policy_vector_index") is created in Atlas, not here.

export default mongoose.model("PolicyChunk", policyChunkSchema);
