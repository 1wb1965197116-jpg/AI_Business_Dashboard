import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import sqlite3 from "sqlite3";
import bodyParser from "body-parser";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => {
    const expected = process.env.APP_PASSWORD;
    if (!expected || expected.length < 20) return res.status(503).json({error: "Configure APP_PASSWORD with at least 20 characters"});
    const header = req.headers.authorization || "";
    let supplied = "";
    if (header.startsWith("Basic ")) {
        const value = Buffer.from(header.slice(6), "base64").toString("utf8");
        const colon = value.indexOf(":");
        if (colon >= 0) supplied = value.slice(colon + 1);
    }
    const digest = value => crypto.createHash("sha256").update(value).digest();
    if (!crypto.timingSafeEqual(digest(supplied), digest(expected))) {
        res.set("WWW-Authenticate", 'Basic realm="Business Dashboard"');
        return res.status(401).json({error: "Authentication required"});
    }
    next();
});

// SQLite DB path
const dbPath = path.join(__dirname, "history.db");
const db = new sqlite3.Database(dbPath);

// Create table if not exists
db.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT,
    response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// OpenAI API key from Render environment
const API_KEY = process.env.OPENAI_API_KEY;

app.post("/ask", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided" });

    try {
        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }]
            })
        });

        const data = await aiRes.json();
        const reply = data.choices[0].message.content;

        db.run("INSERT INTO history(prompt,response) VALUES(?,?)", [prompt, reply]);

        res.json({ reply });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/history", (req, res) => {
    db.all("SELECT * FROM history ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
