import express from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { getRandomWords } from "../lib/vocabManager.js";
import { addDays, toISO, dayInCycle } from "../lib/schedule.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();
const BATCH_SIZE = 30;

// ========== LOGIN (Fetch user status & active batches) ==========
router.post("/login", verifyToken, (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized - missing userId from token" });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  let cycleStart = user.current_cycle_start;
  if (!cycleStart) {
    cycleStart = toISO(new Date());
    db.prepare("UPDATE users SET current_cycle_start=? WHERE id=?").run(cycleStart, userId);
  }

  const currentDay = dayInCycle(cycleStart);

  const activeBatches = db
    .prepare(`
      SELECT id, cycle_start, cycle_end, words, created_at
      FROM batches
      WHERE user_id = ?
      ORDER BY created_at DESC
    `)
    .all(userId)
    .map((b) => ({ ...b, words: JSON.parse(b.words) }));

  const learnedCount = db
    .prepare(`
      SELECT COUNT(*) AS c FROM user_words
      WHERE user_id = ? AND tri_day_total >= 2.5
    `)
    .get(userId).c;

  res.json({
    user: { id: user.id, name: user.name, mode: user.mode, cycle_start: cycleStart },
    stats: { words_learned: learnedCount, current_day: currentDay },
    active_batches: activeBatches,
  });
});

// ========== INIT NEW CYCLE ==========
router.post("/init", verifyToken, (req, res) => {
  console.log("🧩 /vocab/init incoming body:", req.body);

  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized - missing userId from token" });

const { mode = 2, knownWords = [], level = "beginner" } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found" });
console.log(`🎯 Fetching ${mode} batches for level ${level}`);

  const cycleStart = toISO(new Date());
  const cycleEnd = toISO(addDays(new Date(), 3));
  db.prepare("UPDATE users SET mode=?, current_cycle_start=? WHERE id=?").run(mode, cycleStart, userId);

  const excludeSet = new Set(knownWords.map((w) => w.toLowerCase()));
  const strongWords = db
    .prepare(`
      SELECT g.word_en
      FROM user_words uw
      JOIN global_vocab g ON uw.word_id = g.id
      WHERE uw.user_id = ? AND uw.tri_day_total >= 2.5
    `)
    .all(userId)
    .map((r) => r.word_en.toLowerCase());

  strongWords.forEach((w) => excludeSet.add(w));

  const batches = [];
  for (let i = 0; i < mode; i++) {
const picks = getRandomWords(BATCH_SIZE, excludeSet, level);
    picks.forEach((p) => excludeSet.add(p.word.toLowerCase()));
    const words = picks.map((p) => p.word);
    const batchId = uuidv4();

    db.prepare(
      `INSERT INTO batches (id, user_id, cycle_start, cycle_end, words)
       VALUES (?, ?, ?, ?, ?)`
    ).run(batchId, userId, cycleStart, cycleEnd, JSON.stringify(words));

    const insert = db.prepare(`
      INSERT INTO user_words (id, user_id, word_en)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, word_en) DO NOTHING
    `);

    const trx = db.transaction((arr) => {
      for (const w of arr) insert.run(uuidv4(), userId, w);
    });
    trx(words);

    batches.push({ id: batchId, words });
  }

  res.json({ message: "New cycle initialized", cycle_start: cycleStart, cycle_end: cycleEnd, batches });
});

// ========== SUBMIT SCORE ==========
router.post("/submit-score", verifyToken, (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized - missing userId from token" });

  const { word, day, similarityScore } = req.body;
  if (!word || !day) return res.status(400).json({ error: "Missing required fields" });

  const score = Math.max(0, Math.min(1, Number(similarityScore) || 0));
  const rec = db.prepare("SELECT * FROM user_words WHERE user_id = ? AND word_en = ?").get(userId, word);
  if (!rec) return res.status(404).json({ error: "Word not initialized for user" });

  const field = `familiarity_day${day}`;
  const newTotal =
    (day === 1 ? score : rec.familiarity_day1) +
    (day === 2 ? score : rec.familiarity_day2) +
    (day === 3 ? score : rec.familiarity_day3);

  db.prepare(
    `UPDATE user_words SET ${field}=?, tri_day_total=?, last_updated=datetime('now')
     WHERE user_id=? AND word_en=?`
  ).run(score, newTotal, userId, word);

  res.json({ ok: true, word, day, score, tri_day_total: newTotal });
});

// ========== ADVANCE DAY ==========
router.post("/advance-day", verifyToken, (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized - missing userId from token" });

  const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const current = dayInCycle(user.current_cycle_start);
  if (current < 3) {
    const newStart = new Date(user.current_cycle_start);
    newStart.setDate(newStart.getDate() - 1);
    db.prepare("UPDATE users SET current_cycle_start=? WHERE id=?").run(toISO(newStart), userId);
    return res.json({ message: "Advanced by one day", new_day: current + 1 });
  } else {
    return res.json({ message: "Cycle completed; initialize new cycle with /vocab/init" });
  }
});
// ========== REPLACE KNOWN WORDS (day 1 batch cleanup) ==========
router.post("/replace-known", verifyToken, (req, res) => {
  const userId = req.user?.userId;
  const { batchId, remove = [] } = req.body;

  if (!userId) return res.status(401).json({ error: "Unauthorized - missing userId from token" });
  if (!batchId || !Array.isArray(remove)) return res.status(400).json({ error: "Missing or invalid fields" });

  // Load the batch
  const batch = db.prepare("SELECT * FROM batches WHERE id=? AND user_id=?").get(batchId, userId);
  if (!batch) return res.status(404).json({ error: "Batch not found" });

  const words = JSON.parse(batch.words);
  const updated = words.filter((w) => !remove.includes(w.toLowerCase()));

  // Log known words into user_known_words
  const insertKnown = db.prepare(`
    INSERT INTO user_known_words (id, user_id, word_en)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, word_en) DO NOTHING
  `);
  const trxKnown = db.transaction((arr) => {
    for (const w of arr) insertKnown.run(uuidv4(), userId, w);
  });
  trxKnown(remove);

  // Build exclusion set
  const excludeSet = new Set(updated.map((w) => w.toLowerCase()));

  // Exclude strong & known words
  const strongWords = db
    .prepare("SELECT word_en FROM user_words WHERE user_id=? AND tri_day_total>=2.5")
    .all(userId)
    .map((r) => r.word_en.toLowerCase());
  strongWords.forEach((w) => excludeSet.add(w));

  const knownWords = db
    .prepare("SELECT word_en FROM user_known_words WHERE user_id=?")
    .all(userId)
    .map((r) => r.word_en.toLowerCase());
  knownWords.forEach((w) => excludeSet.add(w));

  // Fill to 30
  const newWords = getRandomWords(BATCH_SIZE - updated.length, excludeSet);
  const filled = [...updated, ...newWords.map((p) => p.word)];

  // Update DB batch
  db.prepare("UPDATE batches SET words=? WHERE id=?").run(JSON.stringify(filled), batchId);

  // Ensure all user_words entries exist
  const insertUserWord = db.prepare(`
    INSERT INTO user_words (id, user_id, word_en)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, word_en) DO NOTHING
  `);
  const trxUserWord = db.transaction((arr) => {
    for (const w of arr) insertUserWord.run(uuidv4(), userId, w);
  });
  trxUserWord(filled);

  res.json({
    ok: true,
    batchId,
    removed: remove,
    newWords: newWords.map((p) => p.word),
    finalBatch: filled,
  });
});

export default router;
