const crypto = require("crypto");

const KEYS = {
  // "v2" = leaderboard reset on Nov 16, 2026. Change the version to start fresh again.
  board: "getdls:v2:board",   // sorted set: run id -> score
  runs:  "getdls:v2:runs"     // hash: run id -> JSON {name, score, maxTile, ts}
};

const BOARD_SIZE   = 100;   // entries shown on the leaderboard
const BOARD_KEEP   = 1000;  // entries kept in the database
const MAX_MOVES    = 200000;
const NAME_MAX     = 20;

// Words not allowed in player names (school audience). Kept short to avoid
// blocking real names; use /api/admin to remove anything else.
const BLOCKED = [
  "fuck", "fck", "bitch", "cunt", "nigg", "whore", "slut", "porn",
  "retard", "asshole", "pussy", "hitler"
];

function cleanName(raw) {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    .replace(/[\t\n\r]/g, " ")
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(cleaned).slice(0, NAME_MAX).join("").trim();
}

function isNameAllowed(name) {
  const squashed = name.toLowerCase()
    .replace(/[0@]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e")
    .replace(/4/g, "a").replace(/5|\$/g, "s").replace(/7/g, "t")
    .replace(/[^a-z]/g, "");
  return !BLOCKED.some((w) => squashed.includes(w));
}

// Public id for a run, derived from its seed (seed itself stays private)
function runId(seed) {
  return crypto.createHash("sha256").update("getdls:" + seed).digest("hex").slice(0, 16);
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return req.headers["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "unknown";
}

function send(res, status, body, headers) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(headers || {}).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  // Fallback when the body was not parsed by the platform
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) return null;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { return null; }
}

module.exports = {
  KEYS, BOARD_SIZE, BOARD_KEEP, MAX_MOVES, NAME_MAX,
  cleanName, isNameAllowed, runId, clientIp, send, readJson
};
