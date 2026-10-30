// Creates the Atlas Vector Search index used by the policy assistant.
// Run once after seeding:  npm run create-index
// (You can also create it in the Atlas UI with the same JSON — see README.)
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { PolicyChunk } from "../models/index.js";
import { EMBEDDING_DIMENSIONS } from "../utils/constants.js";
import { VECTOR_INDEX_NAME } from "../services/rag/retrieve.js";

const definition = {
  fields: [
    { type: "vector", path: "embedding", numDimensions: EMBEDDING_DIMENSIONS, similarity: "cosine" },
    { type: "filter", path: "metadata.status" },
    { type: "filter", path: "metadata.appliesToTiers" },
  ],
};

async function main() {
  await connectDB();
  const collection = PolicyChunk.collection;
  const existing = await collection.listSearchIndexes(VECTOR_INDEX_NAME).toArray();
  if (existing.length) {
    console.log(`Index "${VECTOR_INDEX_NAME}" already exists (status: ${existing[0].status}).`);
  } else {
    await collection.createSearchIndex({ name: VECTOR_INDEX_NAME, type: "vectorSearch", definition });
    console.log(`Index "${VECTOR_INDEX_NAME}" created. Atlas needs about a minute to build it (status: PENDING -> READY).`);
  }
  console.log("Definition:", JSON.stringify(definition, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Could not create the vector index:", err.message);
  console.error("Create it manually in Atlas (Atlas Search -> Create Search Index -> Vector Search -> JSON Editor).");
  await mongoose.disconnect();
  process.exit(1);
});
