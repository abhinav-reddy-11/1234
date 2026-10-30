import { PolicyChunk } from "../../models/index.js";
import { embedText } from "./embeddings.js";
import { env } from "../../config/env.js";

export const VECTOR_INDEX_NAME = "policy_vector_index";
const TOP_K = 5;

// Configurable and meant to be calibrated (see README). Atlas reports cosine
// similarity as a score between 0 and 1: score = (1 + cosine) / 2.
export const SIMILARITY_THRESHOLD = env.ragSimilarityThreshold;

// Semantic search over APPROVED chunks that apply to the customer's tier.
export async function retrieveChunks(question, tier) {
  const queryVector = await embedText(question); // same model as ingestion

  const results = await PolicyChunk.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector,
        numCandidates: 100,
        limit: TOP_K,
        // Pre-filter inside Atlas: only approved chunks for this membership tier.
        filter: { "metadata.status": "approved", "metadata.appliesToTiers": { $in: [tier] } },
      },
    },
    { $project: { text: 1, documentId: 1, metadata: 1, score: { $meta: "vectorSearchScore" } } },
  ]);

  // Defence in depth: re-check the filter in code too.
  const allowed = results.filter(
    (r) => r.metadata?.status === "approved" && r.metadata?.appliesToTiers?.includes(tier)
  );
  return {
    all: allowed,
    relevant: allowed.filter((r) => r.score >= SIMILARITY_THRESHOLD),
    topScore: allowed[0]?.score ?? 0,
  };
}
