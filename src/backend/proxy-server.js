// MUST run BEFORE any model loads
import { env } from "@xenova/transformers";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

try {
  // Correct backend setup
  env.backend = "onnxruntime-node";
  env.platform = "node";

  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  env.localModelPath = "./models";
  env.HF_TOKEN = process.env.HF_TOKEN;

  env.useLazyBackend = true;

  console.log(" Using ONNX backend:", env.backend);
} catch (err) {
  console.error("Could not set ONNX backend, falling back to WASM:", err);
  env.backend = "wasm";
}

// Diagnostics
function has(mod) {
  try { require.resolve(mod); return true; } catch { return false; }
}

console.log(" TRANSFORMERS backend =", env.backend);
console.log(" onnxruntime-node present:", has("onnxruntime-node"));
console.log(" onnxruntime-web present:", has("onnxruntime-web"));
console.log(" Node version =", process.versions.node);
console.log(" HF token prefix:", (env.HF_TOKEN || "MISSING").slice(0, 8));

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";
import db from "./db.js";

// Routes
import translationRoute from "./routes/translate.js";
import similarityRoute from "./routes/similarity.js";
import generationRoute from "./routes/generate.js";
import vocabRoutes from "./routes/vocab.js";
import authRoutes from "./routes/auth.js";

import { loadData } from "./lib/vocabManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load vocab
loadData();

// Initialize server
const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get("/", (_req, res) => res.send("Word Nerd proxy is running "));

app.use("/auth", authRoutes);
app.use("/translate", translationRoute);
app.use("/similarity", similarityRoute);
app.use("/generate", generationRoute);
app.use("/vocab", vocabRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Proxy running and reachable on http://0.0.0.0:${PORT}`)
);
