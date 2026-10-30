import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env.js";
import { dbStatus } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { AppError } from "./utils/AppError.js";
import authRoutes from "./routes/authRoutes.js";
import coreRoutes from "./routes/coreRoutes.js";
import operationsRoutes from "./routes/operationsRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

const app = express();

// Allow only the origins listed in CLIENT_URL (local dev + deployed Vercel URL).
app.use(
  cors({
    origin(origin, callback) {
      // Requests with no Origin header (curl, Postman, Render health checks) are allowed.
      if (!origin || env.clientUrls.includes(origin)) return callback(null, true);
      callback(new AppError(403, `CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json({ limit: "1mb" }));
if (env.nodeEnv === "development") app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "RetailPulse AI backend is running",
    database: dbStatus(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api", coreRoutes);
app.use("/api", operationsRoutes);
app.use("/api", aiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
