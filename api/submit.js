// POST /api/submit  { name, seed, moves, score }
// The server replays the moves from the seed with the real game code and
// only records the score that replay produces.
const redis = require("./_lib/redis");
const { replay } = require("./_lib/replay");
const {
  KEYS, BOARD_KEEP, MAX_MOVES,
  cleanName, isNameAllowed, runId, clientIp, send, readJson
} = require("./_lib/common");

const RATE_LIMIT = 15; // submissions per IP per minute

module.exports = async function handler(req, res) {
  const noStore = { "Cache-Control": "no-store" };

  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" }, { Allow: "POST", ...noStore });
  }

  try {
    if (!redis.isConfigured()) {
      return send(res, 503, { error: "Leaderboard database is not connected yet." }, noStore);
    }

    const body = await readJson(req);
    if (!body) return send(res, 400, { error: "Invalid request." }, noStore);

    const name = cleanName(body.name);
    const seed = body.seed;
    const moves = body.moves;

    if (!name) return send(res, 400, { error: "Enter a name first." }, noStore);
    if (!isNameAllowed(name)) return send(res, 400, { error: "Please pick a different name." }, noStore);
    if (typeof moves !== "string" || moves.length > MAX_MOVES) {
      return send(res, 400, { error: "Invalid game." }, noStore);
    }

    // Rate limit per IP
    const minute = Math.floor(Date.now() / 60000);
    const rlKey = "getdls:rl:" + clientIp(req) + ":" + minute;
    const [count] = await redis.pipeline([["INCR", rlKey], ["EXPIRE", rlKey, 120]]);
    if (count > RATE_LIMIT) {
      return send(res, 429, { error: "Too many submissions. Try again in a minute." }, noStore);
    }

    // Replay the game to get the real score
    const result = replay(seed, moves);
    if (!result) return send(res, 400, { error: "That game couldn't be verified." }, noStore);
    if (!result.over && !result.won) {
      return send(res, 400, { error: "Finish the game (or reach De La Salle) before submitting." }, noStore);
    }
    if (body.score !== undefined && Number(body.score) !== result.score) {
      return send(res, 400, { error: "That score couldn't be verified." }, noStore);
    }
    if (result.score <= 0) return send(res, 400, { error: "No points to submit." }, noStore);

    const id = runId(seed);

    // The same game can be submitted again only with a higher score
    // (e.g. once at De La Salle, then again after it ends).
    const existingRaw = await redis.command(["HGET", KEYS.runs, id]);
    if (existingRaw) {
      let existing = {};
      try { existing = JSON.parse(existingRaw) || {}; } catch (e) {}
      if ((existing.score || 0) >= result.score) {
        const rank = await redis.command(["ZREVRANK", KEYS.board, id]);
        return send(res, 200, {
          ok: true, duplicate: true, id, score: existing.score,
          rank: rank === null ? null : rank + 1
        }, noStore);
      }
    }

    const record = JSON.stringify({
      name,
      score: result.score,
      maxTile: result.maxTile,
      moves: result.moves,
      ts: Date.now()
    });

    const out = await redis.pipeline([
      ["HSET", KEYS.runs, id, record],
      ["ZADD", KEYS.board, result.score, id],
      ["ZREMRANGEBYRANK", KEYS.board, 0, -(BOARD_KEEP + 1)],
      ["ZREVRANK", KEYS.board, id]
    ]);
    const rank = out[3];

    return send(res, 200, {
      ok: true, id, score: result.score, maxTile: result.maxTile,
      rank: rank === null ? null : rank + 1
    }, noStore);
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || "Server error" }, noStore);
  }
};
