import fs from "fs";
import { execSync } from "child_process";
import fetch from "node-fetch";

// ---------- CONFIG ----------
const USE_GIT_PUSH = true; // set to false to skip git push
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // optional, for advanced AI fixes
// ----------------------------

// Read server.js
let serverContent = fs.readFileSync("server.js", "utf-8");

// 1️⃣ Ensure express is imported
if (!serverContent.includes("import express")) {
    serverContent = "import express from 'express';\n" + serverContent;
    console.log("[Fix] Added missing express import.");
    fs.writeFileSync("server.js", serverContent);
}

// 2️⃣ Check package.json
const pkgPath = "package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

if (!pkg.dependencies) pkg.dependencies = {};

// Required dependencies
const requiredDeps = {
    "express": "^4.18.2",
    "node-fetch": "^3.4.0",
    "cors": "^2.8.5",
    "sqlite3": "^5.1.6",
    "body-parser": "^1.20.2"
};

let depFixed = false;
for (const [dep, version] of Object.entries(requiredDeps)) {
    if (!pkg.dependencies[dep]) {
        pkg.dependencies[dep] = version;
        console.log(`[Fix] Added missing dependency: ${dep}`);
        depFixed = true;
    }
}

// Ensure scripts.start exists
if (!pkg.scripts || !pkg.scripts.start) {
    if (!pkg.scripts) pkg.scripts = {};
    pkg.scripts.start = "node server.js";
    console.log("[Fix] Added missing start script.");
    depFixed = true;
}

// Ensure Node version is set
if (!pkg.engines || !pkg.engines.node) {
    pkg.engines = { node: "20.x" };
    console.log("[Fix] Set Node version to 20.x");
    depFixed = true;
}

// Save package.json if any changes
if (depFixed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log("[Fix] package.json updated.");
}

// 3️⃣ Install missing dependencies
console.log("Installing dependencies...");
execSync("npm install", { stdio: "inherit" });

// 4️⃣ Optional: git commit & push
if (USE_GIT_PUSH) {
    try {
        execSync('git add .', { stdio: "inherit" });
        execSync('git commit -m "Auto-fix deployment issues"', { stdio: "inherit" });
        execSync('git push', { stdio: "inherit" });
        console.log("[Deploy] Changes pushed to GitHub. Render should redeploy automatically.");
    } catch (err) {
        console.log("[Warning] Git push failed. Maybe no changes or git not configured.");
    }
}

// 5️⃣ Optional: AI advanced check using OpenAI API
async function aiCheck() {
    if (!OPENAI_API_KEY) return;
    try {
        const prompt = `Check this Node.js backend for deployment issues and suggest fixes:\n\n${serverContent}`;
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }]
            })
        });
        const data = await res.json();
        const advice = data.choices[0].message.content;
        console.log("\n[AI Advice]\n", advice);
    } catch (err) {
        console.log("[AI Error]", err.message);
    }
}

// Run AI check if API key exists
aiCheck();
