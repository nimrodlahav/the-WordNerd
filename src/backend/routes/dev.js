import express from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";

const router = express.Router();

// POST /dev/create-user
router.post("/create-user", (req, res) => {
  const id = uuidv4();
  const { email = "test@example.com", name = "Test User", mode = 2 } = req.body || {};

  db.prepare(`
    INSERT INTO users (id, email, name, mode, current_cycle_start)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(id, email, name, mode);

  res.json({ id, email, name, mode });
});

export default router;
