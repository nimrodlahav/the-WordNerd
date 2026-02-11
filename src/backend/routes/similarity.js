
import express from "express";
import { pipeline } from "@xenova/transformers";

const router = express.Router();

let embedder = null;
async function loadEmbedder() {
  if (!embedder) {
    console.log(" Loading multilingual sentence-embedder...");
    // Multilingual ST model aligned across 50+ languages (incl. Hebrew)
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
    );
    console.log("Multilingual embedder ready");
  }
  return embedder;
}

// Cosine similarity
function cosineSimilarity(a, b) {
  const dot = a.reduce((s, x, i) => s + x * b[i], 0);
  const na = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  const nb = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
  return dot / (na * nb);
}

// Optional: clamp to [0..1] just for display; cosine can be [-1..1]
function clamp01(x) {
  return Math.max(0, Math.min(1, (x + 1) / 2)); // map [-1,1] -> [0,1]
}

router.post("/", async (req, res) => {
  const { source, target } = req.body || {};
  if (!source || !target) {
    return res.status(400).json({ error: "Missing 'source' or 'target'." });
  }

  try {
    const model = await loadEmbedder();

    // Create language-agnostic sentence embeddings
    const [embA, embB] = await Promise.all([
      model(source, { pooling: "mean", normalize: true }),
      model(target, { pooling: "mean", normalize: true }),
    ]);

    // transformers.js can return a Tensor or raw array depending on backend
    const vecA = embA.data ? Array.from(embA.data) : embA[0];
    const vecB = embB.data ? Array.from(embB.data) : embB[0];

// --- Evaluate and respond ---
const raw = cosineSimilarity(vecA, vecB); // in [-1..1]

// Feedback calibrated for sentence-transformer models
let feedback = "Not similar";
if (raw >= 0.89) feedback = "Correct or very close";
else if (raw >= 0.67) feedback = "Close";

console.log(
  ` ${source} vs ${target} | cosine: ${raw.toFixed(3)}`
);

res.json({
  source,
  target,
  cosine: Number(raw.toFixed(3)),
  feedback,
  model: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
});

  } catch (err) {
    console.error("Similarity error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
