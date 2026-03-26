import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import sqlite3 from "sqlite3";
import bodyParser from "body-parser";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database("./history.db");
db.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT,
    response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

const API_KEY = process.env.OPENAI_API_KEY || "YOUR_OPENAI_API_KEY_HERE";

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
