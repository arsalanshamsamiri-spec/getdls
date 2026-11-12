// Seeded random number generator shared by the browser game and the
// leaderboard server, so a finished game can be replayed move-for-move
// to verify its score.
//
// A seed is 32 hex characters (128 bits). The generator is sfc32, which
// only uses 32-bit integer math and gives identical results everywhere.

function GameRandom(seed) {
  if (!GameRandom.isValidSeed(seed)) {
    throw new Error("Invalid seed");
  }

  this.a = parseInt(seed.slice(0, 8), 16) >>> 0;
  this.b = parseInt(seed.slice(8, 16), 16) >>> 0;
  this.c = parseInt(seed.slice(16, 24), 16) >>> 0;
  this.d = parseInt(seed.slice(24, 32), 16) >>> 0;

  // Warm up the generator so similar seeds diverge quickly
  for (var i = 0; i < 15; i++) this.next();
}

GameRandom.isValidSeed = function (seed) {
  return typeof seed === "string" && /^[0-9a-f]{32}$/.test(seed);
};

GameRandom.newSeed = function () {
  var words = new Uint32Array(4);
  var cryptoObj = (typeof crypto !== "undefined" && crypto) ||
                  (typeof window !== "undefined" && window.msCrypto);

  if (cryptoObj && cryptoObj.getRandomValues) {
    cryptoObj.getRandomValues(words);
  } else {
    for (var i = 0; i < 4; i++) {
      words[i] = Math.floor(Math.random() * 4294967296) >>> 0;
    }
  }

  var seed = "";
  for (var j = 0; j < 4; j++) {
    seed += ("00000000" + words[j].toString(16)).slice(-8);
  }
  return seed;
};

// Returns a float in [0, 1), like Math.random()
GameRandom.prototype.next = function () {
  var a = this.a, b = this.b, c = this.c, d = this.d;
  var t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = (b ^ (b >>> 9)) >>> 0;
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;
  this.a = a; this.b = b; this.c = c; this.d = d;
  return t / 4294967296;
};
