// routes/translate.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// Simple Hebrew → English translation using Google Translate API (free endpoint)
router.post("/", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "he");  // source: Hebrew
    url.searchParams.set("tl", "en");  // target: English
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);

    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const translated = data?.[0]?.[0]?.[0] || "Translation unavailable";

    res.json({ translatedText: translated });
  } catch (err) {
    console.error("🌐 Translation error:", err);
    res.status(500).json({ error: "Translation failed", detail: err.message });
  }
});

export default router;
