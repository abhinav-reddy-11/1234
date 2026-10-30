import { pipeline } from "@huggingface/transformers";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "../../utils/constants.js";

// Transformers.js runs the embedding model locally inside Node (no API key).
// The model (~25 MB) downloads once on first use and is cached afterwards.
let extractorPromise = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", EMBEDDING_MODEL).catch((err) => {
      extractorPromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return extractorPromise;
}

let customEmbedder = null; // test hook only: lets tests run without downloading the model
export function __setEmbedderForTests(fn) {
  customEmbedder = fn;
}

// Text -> 384 numbers. Mean pooling + normalisation is the standard setup for
// all-MiniLM-L6-v2 and makes cosine similarity meaningful.
export async function embedText(text) {
  const vector = customEmbedder
    ? await customEmbedder(text)
    : Array.from((await (await getExtractor())(text, { pooling: "mean", normalize: true })).data);

  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS}-dim embedding, got ${vector.length}`);
  }
  return vector;
}

// Load the model at server start so the first customer question isn't slow.
export async function warmUpEmbeddings() {
  try {
    await embedText("warm up");
    console.log(`Embedding model ready: ${EMBEDDING_MODEL}`);
  } catch (err) {
    console.warn("Embedding model could not be loaded yet:", err.message);
  }
}
