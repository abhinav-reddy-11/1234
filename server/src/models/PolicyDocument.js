import mongoose from "mongoose";
import { TIERS, POLICY_STATUS } from "../utils/constants.js";

const policyDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    version: { type: Number, required: true, min: 1, default: 1 },
    appliesToTiers: {
      type: [{ type: String, enum: TIERS }],
      default: () => [...TIERS], // applies to everyone unless narrowed
      validate: [(t) => t.length > 0, "Select at least one membership tier"],
    },
    // New uploads stay "pending" until an admin approves them.
    status: { type: String, enum: POLICY_STATUS, default: "pending" },
    fileName: { type: String, required: true },
    chunkCount: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

// Version management: the same title cannot have two documents with the same version.
policyDocumentSchema.index({ title: 1, version: 1 }, { unique: true });

export default mongoose.model("PolicyDocument", policyDocumentSchema);
