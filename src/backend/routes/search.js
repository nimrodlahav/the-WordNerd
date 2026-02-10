// routes/search.js
import express from "express";
import fs from "fs";

const router = express.Router();

// Load vocab once
const vocabPath = new URL("../data/vocab.en-he.json", import.meta.url).pathname;
const vocab = JSON.parse(fs.readFileSync(vocabPath, "utf8"));

// 🔎 Search for word(s) in English or Hebrew
router.get("/", (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  if (!q) return res.status(400).json({ error: "Missing search query" });

  const results = Object.entries(vocab)
    .filter(([eng, info]) => {
      const heb = info.translation.toLowerCase();
      return eng.includes(q) || heb.includes(q);
    })
    .map(([eng, info]) => ({
      word: eng,
      translation: info.translation,
      topic: info.topic,
      level: info.level,
      example: info.example || null,
    }));

  res.json({ query: q, count: results.length, results });
});

export default router;
