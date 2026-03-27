import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import fetch from "node-fetch";

const USE_GIT_PUSH = true; // set false to skip push
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // optional for AI suggestions

// Helper: recursively get all .js files in folder
function getJsFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    list.forEach((file) => {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(getJsFiles(filePath));
        } else if (file.isFile() && file.name.endsWith(".js")) {
            results.push(filePath);
        }
    });
    return results;
}

// 1️⃣ Scan all JS files for used modules (imports)
const jsFiles = getJsFiles(".");
const usedModules = new Set();

jsFiles.forEach((file) => {
    const content = fs.readFileSync(file, "utf-8");
    const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        if (!match[1].startsWith(".") && !match[1].startsWith("/")) {
            usedModules.add(match[1]);
        }
    }
});

// 2️⃣ Update package.json
const pkgPath = "package.json";
if (!fs.existsSync(pkgPath)) {
    console.log("[Error] package.json not found. Please create one first.");
    process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
if (!pkg.dependencies) pkg.dependencies = {};

// Add missing dependencies
usedModules.forEach((mod) => {
    if (!pkg.dependencies[mod]) {
        pkg.dependencies[mod] = "latest";
        console.log(`[Fix] Added missing dependency: ${mod}`);
    }
});

// Ensure start script exists
if (!pkg.scripts || !pkg.scripts.start) {
    if (!pkg.scripts) pkg.scripts = {};
    pkg.scripts.start = "node server.js"; // default entry, adjust if needed
    console.log("[Fix] Added start script in package.json.");
}

// Ensure Node version
if (!pkg.engines || !pkg.engines.node) {
    pkg.engines = { node: "20.x" };
    console.log("[Fix] Set Node version to 20.x");
}

// Save package.json
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log("[Info] package.json updated.");

// 3️⃣ Install dependencies
console.log("[Info] Installing dependencies...");
execSync("npm install", { stdio: "inherit" });

// 4️⃣ Git commit & push
if (USE_GIT_PUSH) {
    try {
        execSync("git add .", { stdio: "inherit" });
        execSync('git commit -m "Auto-fix deployment issues"', { stdio: "inherit" });
        execSync("git push", { stdio: "inherit" });
        console.log("[Deploy] Changes pushed to GitHub. Render should redeploy.");
    } catch (err) {
        console.log("[Warning] Git push failed or no changes to commit.");
    }
}

// 5️⃣ Optional: AI code advice
async function aiCheck() {
    if (!OPENAI_API_KEY) return;

    let allCode = "";
    jsFiles.forEach((f) => {
        allCode += `\n// File: ${f}\n` + fs.readFileSync(f, "utf-8");
    });

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: `Check the following Node.js project for deployment issues and suggest fixes:\n${allCode}`,
                    },
                ],
            }),
        });
        const data = await response.json();
        const advice = data.choices[0].message.content;
        console.log("\n[AI Advice]\n", advice);
    } catch (err) {
        console.log("[AI Error]", err.message);
    }
}

aiCheck();
