import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "@xenova/transformers";

const router = express.Router();

// --- Load vocab safely ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const vocabPath = path.join(__dirname, "../data/vocab.en-he.json");
const vocabData = JSON.parse(fs.readFileSync(vocabPath, "utf8"));

// --- Cache generator ---
let textGenerator = null;
async function getGenerator() {
  if (!textGenerator) {
    console.log("🧠 Loading text generation model...");
    textGenerator = await pipeline("text-generation", "Xenova/distilgpt2");
    console.log("✅ Sentence generator ready!");
  }
  return textGenerator;
}


router.post("/", async (req, res) => {
  const { word } = req.body;
  const entry = vocabData[word?.toLowerCase()];
  if (!entry) return res.status(404).json({ error: "Word not found in vocab." });

  const staticSentence = entry.example || `Example for "${word}" not available.`;
  // --- GENERATE MODE ---
  let generatedSentence = null;
  try {
    const generator = await getGenerator();
    const prompt = `Write one short and simple English sentence using the word "${word}". Example: "I am happy today." Sentence:`;

    const output = await generator(prompt, {
      max_new_tokens: 25,     // a bit more room
      temperature: 0.9,       // slightly higher creativity
      top_p: 0.9,
      do_sample: true
    });

    generatedSentence = output[0]?.generated_text
      ?.replace(prompt, "")
      ?.trim()
      ?.split(/[.?!]/)[0];

    if (generatedSentence && generatedSentence.length > 2) {
      if (!/[.?!]$/.test(generatedSentence)) generatedSentence += ".";
    } else {
      generatedSentence = null; // if it’s junk, discard
    }
  } catch (err) {
    console.error("⚠️ Generation error:", err);
  }

  // fallback
  const finalSentence = generatedSentence || entry.example || "No sentence available.";

  res.json({
    word,
    translation: entry.translation,
    topic: entry.topic,
    level: entry.level,
    static_sentence: entry.example || null,
    generated_sentence: finalSentence
  });

});

export default router;
