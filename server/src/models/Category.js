import mongoose from "mongoose";

// Separate collection so admins can add/rename categories without touching products.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
