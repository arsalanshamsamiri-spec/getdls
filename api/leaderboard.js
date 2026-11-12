// GET /api/leaderboard -> { entries: [{ id, name, score, maxTile, ts }] }
const redis = require("./_lib/redis");
const { KEYS, BOARD_SIZE, send } = require("./_lib/common");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, { error: "Method not allowed" }, { Allow: "GET" });
  }

  try {
    const flat = await redis.command(["ZREVRANGE", KEYS.board, 0, BOARD_SIZE - 1, "WITHSCORES"]);
    const ids = [];
    const scores = {};
    for (let i = 0; i < flat.length; i += 2) {
      ids.push(flat[i]);
      scores[flat[i]] = Number(flat[i + 1]);
    }

    let entries = [];
    if (ids.length) {
      const rows = await redis.command(["HMGET", KEYS.runs].concat(ids));
      entries = ids.map((id, i) => {
        let info = {};
        try { info = JSON.parse(rows[i] || "{}") || {}; } catch (e) {}
        return {
          id,
          name: info.name || "Anonymous",
          score: scores[id],
          maxTile: info.maxTile || 0,
          ts: info.ts || 0
        };
      });
    }

    send(res, 200, { entries }, {
      // Cache briefly at Vercel's edge so a busy page doesn't hit the database every time
      "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30"
    });
  } catch (err) {
    send(res, err.status || 500, { error: err.message || "Server error" }, { "Cache-Control": "no-store" });
  }
};
