import dotenv from "dotenv";

dotenv.config();

// Fail fast if a required variable is missing, so the server never runs half-configured.
const required = ["MONGODB_URI", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required env variables: ${missing.join(", ")}`);
  process.exit(1);
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  groqApiKey: process.env.GROQ_API_KEY || "", // optional: core features work without it
  // Minimum Atlas vectorSearchScore for a policy chunk to count as evidence. Calibrate this.
  ragSimilarityThreshold: Number(process.env.RAG_SIMILARITY_THRESHOLD) || 0.7,
  // CLIENT_URL can hold several origins separated by commas,
  // e.g. "http://localhost:5173,https://retailpulse.vercel.app"
  clientUrls: (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean),
};
