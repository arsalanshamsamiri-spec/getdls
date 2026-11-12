// Replays a game on the server using the exact same game code the
// browser runs (js/rng.js, js/grid.js, js/tile.js, js/game_manager.js),
// so a submitted score can only be one the moves really produce.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const FILES = ["rng.js", "grid.js", "tile.js", "game_manager.js"];

function findJsDir() {
  const candidates = [
    path.join(__dirname, "..", "..", "js"),
    path.join(process.cwd(), "js")
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "game_manager.js"))) return dir;
  }
  throw new Error("Game code not found on the server");
}

let GameManager = null;
let GameRandom = null;

function load() {
  if (GameManager) return;
  const dir = findJsDir();
  const source = FILES.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n;\n") +
    "\n;this.__exports = { GameManager: GameManager, GameRandom: GameRandom };";

  const context = {}; // a fresh sandbox has its own Math, Object, etc.
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "game.js" });
  GameManager = context.__exports.GameManager;
  GameRandom = context.__exports.GameRandom;
}

function replay(seed, moves) {
  load();
  if (!GameRandom.isValidSeed(seed)) return null;
  if (typeof moves !== "string" || !/^[0-3]*$/.test(moves)) return null;
  return GameManager.replay(seed, moves);
}

module.exports = { replay };
