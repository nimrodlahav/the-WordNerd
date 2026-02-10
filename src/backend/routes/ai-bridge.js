// routes/ai-bridge.js
import express from "express";
import similarityRouter from "./similarity.js";
import generateRouter from "./generate.js";

const router = express.Router();

/**
 * Compatibility bridge:
 *  /ai/similarity → handled by routes/similarity.js
 *  /ai/sentence   → handled by routes/generate.js
 */
router.use("/similarity", similarityRouter);
router.use("/sentence", generateRouter);

export default router;
