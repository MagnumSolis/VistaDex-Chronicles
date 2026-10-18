// ── dev-proxy.js — Run the Worker's handler locally in Node (no Cloudflare needed) ──
// Usage: node scripts/dev-proxy.js [port]     → http://localhost:8787
// Reads keys from ./.env if present (never committed). Data is kept in memory
// and lost on exit. Point the frontend at it by setting PROXY_URL in
// prototype/config.js to "http://localhost:8787" (don't commit that change).
import http from "node:http";
import fs from "node:fs";
import { handle } from "../worker/src/index.js";
import { memoryStore } from "../worker/src/store.js";

const port = Number(process.argv[2]) || 8787;
const env = { ALLOWED_ORIGINS: "http://localhost:5173,http://127.0.0.1:5173", ...readDotEnv(".env") };
const store = memoryStore();

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: Object.fromEntries(Object.entries(req.headers).filter(([, v]) => typeof v === "string")),
    body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
  });
  const response = await handle(request, env, { store });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, "127.0.0.1", () => {
  const keys = ["GROQ_API_KEY", "MISTRAL_API_KEY", "TINYFISH_API_KEY"].filter(k => env[k]);
  console.log(`VistaDex dev proxy on http://localhost:${port} — ${keys.length ? `keys: ${keys.join(", ")}` : "no keys (mock path)"}`);
});

function readDotEnv(path) {
  if (!fs.existsSync(path)) return {};
  const out = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
