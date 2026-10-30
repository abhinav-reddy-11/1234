import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { warmUpEmbeddings } from "./services/rag/embeddings.js";

const PORT = env.port; // Render injects PORT; locally it defaults to 5000

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      warmUpEmbeddings(); // loads the embedding model in the background
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
