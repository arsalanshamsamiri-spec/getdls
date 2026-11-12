// Moderation endpoint. Only works if you set an ADMIN_TOKEN env var in Vercel.
//
//   Remove one entry (ids are in /api/leaderboard):
//     curl -X POST https://YOUR-SITE.vercel.app/api/admin \
//       -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
//       -H "Content-Type: application/json" \
//       -d '{"action":"remove","id":"abcd1234abcd1234"}'
//
//   Remove every entry with a given name:
//       -d '{"action":"remove-name","name":"Some Name"}'
//
//   Wipe the whole leaderboard:
//       -d '{"action":"reset","confirm":"RESET"}'
const crypto = require("crypto");
const redis = require("./_lib/redis");
const { KEYS, send, readJson } = require("./_lib/common");

function tokenMatches(given, expected) {
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(String(expected || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  const noStore = { "Cache-Control": "no-store" };
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) return send(res, 404, { error: "Not found" }, noStore);
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" }, noStore);

  const auth = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tokenMatches(auth, expected)) return send(res, 401, { error: "Unauthorized" }, noStore);

  try {
    const body = (await readJson(req)) || {};

    if (body.action === "remove" && typeof body.id === "string") {
      const [removed] = await redis.pipeline([
        ["ZREM", KEYS.board, body.id],
        ["HDEL", KEYS.runs, body.id]
      ]);
      return send(res, 200, { ok: true, removed }, noStore);
    }

    if (body.action === "remove-name" && typeof body.name === "string") {
      const all = await redis.command(["HGETALL", KEYS.runs]);
      const target = body.name.trim().toLowerCase();
      const ids = [];
      for (let i = 0; i < all.length; i += 2) {
        try {
          const info = JSON.parse(all[i + 1]);
          if (String(info.name || "").trim().toLowerCase() === target) ids.push(all[i]);
        } catch (e) {}
      }
      if (ids.length) {
        await redis.pipeline([
          ["ZREM", KEYS.board].concat(ids),
          ["HDEL", KEYS.runs].concat(ids)
        ]);
      }
      return send(res, 200, { ok: true, removed: ids.length }, noStore);
    }

    if (body.action === "reset" && body.confirm === "RESET") {
      await redis.command(["DEL", KEYS.board, KEYS.runs]);
      return send(res, 200, { ok: true }, noStore);
    }

    return send(res, 400, { error: "Unknown action" }, noStore);
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || "Server error" }, noStore);
  }
};
