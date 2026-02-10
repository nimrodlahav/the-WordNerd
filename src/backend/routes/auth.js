import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { email, password, name = "" } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(400).json({ error: "User already exists" });
    }

    // 🔐 hash and store under password_hash
    const password_hash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(id, email, name, password_hash);

    const token = jwt.sign({ userId: id, email }, JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      ok: true,
      token,
      user: { id, email, name },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = db
      .prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?")
      .get(email);

    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      ok: true,
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
