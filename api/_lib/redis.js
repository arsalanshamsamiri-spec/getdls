// Minimal Upstash Redis REST client (no npm packages needed).
// Works with the env vars Vercel adds when you connect an Upstash
// database from the Vercel Marketplace (KV_REST_API_*), or with the
// ones Upstash shows in its own console (UPSTASH_REDIS_REST_*).

const URL_VARS   = ["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"];
const TOKEN_VARS = ["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"];

function firstEnv(names) {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
  }
  return "";
}

function config() {
  const url = firstEnv(URL_VARS).replace(/\/+$/, "");
  const token = firstEnv(TOKEN_VARS);
  return url && token ? { url, token } : null;
}

function isConfigured() {
  return !!config();
}

async function call(path, body) {
  const cfg = config();
  if (!cfg) {
    const err = new Error("Leaderboard database is not connected yet.");
    err.status = 503;
    throw err;
  }

  const res = await fetch(cfg.url + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + cfg.token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const err = new Error("Database error" + (data && data.error ? ": " + data.error : ""));
    err.status = 502;
    throw err;
  }
  return data;
}

// Run one command, e.g. command(["ZADD", "key", 10, "member"])
async function command(args) {
  const data = await call("", args);
  if (data.error) {
    const err = new Error("Database error: " + data.error);
    err.status = 502;
    throw err;
  }
  return data.result;
}

// Run several commands in one round trip; returns their results in order
async function pipeline(commands) {
  const data = await call("/pipeline", commands);
  return data.map((item) => {
    if (item.error) {
      const err = new Error("Database error: " + item.error);
      err.status = 502;
      throw err;
    }
    return item.result;
  });
}

module.exports = { command, pipeline, isConfigured };
