// Tabs, score submission and the global leaderboard.
(function () {
  var API_TOP    = "/api/leaderboard";
  var API_SUBMIT = "/api/submit";
  var NAME_KEY   = "ebalPlayerName";
  var MINE_KEY   = "ebalMyRuns";

  var TILE_IMAGES = {
    2: "dougherty", 4: "foothill", 8: "dublin", 16: "livermore",
    32: "granada", 64: "montevista", 128: "amador", 256: "california",
    512: "sanramon", 1024: "carondelet", 2048: "delasalle",
    4096: "cook", 8192: "reedley", 16384: "grove", 32768: "odyssey"
  };
  var TILE_NAMES = {
    2: "Dougherty Valley", 4: "Foothill", 8: "Dublin", 16: "Livermore",
    32: "Granada", 64: "Monte Vista", 128: "Amador Valley", 256: "California",
    512: "San Ramon Valley", 1024: "Carondelet", 2048: "De La Salle",
    4096: "Cook", 8192: "Reedley", 16384: "Grove", 32768: "Odyssey"
  };

  function tileImage(value) {
    return "img/" + (value > 32768 ? "ihtfp" : (TILE_IMAGES[value] || "dougherty")) + ".png";
  }
  function tileName(value) {
    return value > 32768 ? "IHTFP (" + value + ")" : (TILE_NAMES[value] || "");
  }

  // Storage that never throws (private browsing, disabled storage, ...)
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  };

  function myRuns() {
    try { return JSON.parse(store.get(MINE_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function rememberRun(id, score) {
    var runs = myRuns();
    runs[id] = score;
    var keys = Object.keys(runs);
    if (keys.length > 200) delete runs[keys[0]];
    store.set(MINE_KEY, JSON.stringify(runs));
  }

  function $(sel) { return document.querySelector(sel); }

  // ---------------------------------------------------------------- tabs
  function showTab(name) {
    var lb = name === "leaderboard";
    document.body.classList.toggle("show-leaderboard", lb);
    var tabs = document.querySelectorAll(".tabs .tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === name);
      tabs[i].setAttribute("aria-selected", tabs[i].getAttribute("data-tab") === name ? "true" : "false");
    }
    if (lb) loadLeaderboard(false);
  }

  function tabFromHash() {
    return window.location.hash === "#leaderboard" ? "leaderboard" : "play";
  }

  // ------------------------------------------------------- leaderboard
  var lastLoad = 0;
  var loading = false;

  function setMessage(text) {
    var msg = $(".leaderboard-message");
    msg.textContent = text || "";
    msg.style.display = text ? "block" : "none";
  }

  function loadLeaderboard(force) {
    if (loading) return;
    if (!force && Date.now() - lastLoad < 15000) return;
    loading = true;
    if (!lastLoad) setMessage("Loading…");

    var url = API_TOP + (force ? "?t=" + Date.now() : "");
    fetch(url, { headers: { "Accept": "application/json" } })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw new Error(body.error || ("Error " + r.status));
          return body;
        });
      })
      .then(function (body) {
        lastLoad = Date.now();
        renderLeaderboard(body.entries || []);
      })
      .catch(function (err) {
        $(".leaderboard-body").innerHTML = "";
        setMessage("Couldn't load the leaderboard. " + err.message);
      })
      .then(function () { loading = false; });
  }

  function renderLeaderboard(entries) {
    var body = $(".leaderboard-body");
    var mine = myRuns();
    body.innerHTML = "";

    if (!entries.length) {
      setMessage("No scores yet. Be the first on the board!");
      return;
    }
    setMessage("");

    entries.forEach(function (e, i) {
      var tr = document.createElement("tr");
      if (i < 3) tr.className = "top-3";
      if (e.id && mine.hasOwnProperty(e.id)) tr.className += " mine";

      var rank = document.createElement("td");
      rank.className = "col-rank";
      rank.textContent = String(i + 1);

      var name = document.createElement("td");
      name.className = "col-name";
      name.textContent = e.name;

      var tileCell = document.createElement("td");
      tileCell.className = "col-tile";
      var tile = document.createElement("span");
      tile.className = "mini-tile";
      tile.style.backgroundImage = "url(" + tileImage(e.maxTile) + ")";
      tile.title = tileName(e.maxTile);
      tileCell.appendChild(tile);

      var score = document.createElement("td");
      score.className = "col-score";
      score.textContent = Number(e.score).toLocaleString();

      tr.appendChild(rank);
      tr.appendChild(name);
      tr.appendChild(tileCell);
      tr.appendChild(score);
      body.appendChild(tr);
    });
  }

  // ------------------------------------------------- score submission
  var currentRun = null;   // { seed, moves, score, maxTile }
  var submitted  = {};     // seed -> score already accepted this session
  var submitting = false;

  function setStatus(html, isError) {
    var el = $(".submit-status");
    el.className = "submit-status" + (isError ? " error" : "");
    el.innerHTML = html || "";
  }

  function onGameState(meta) {
    var panel = $(".submit-score");
    var finished = meta.over || (meta.won && meta.terminated);

    if (!finished || meta.score <= 0) {
      panel.classList.remove("visible");
      if (!finished) currentRun = null;
      return;
    }

    currentRun = { seed: meta.seed, moves: meta.moves, score: meta.score, maxTile: meta.maxTile };

    $(".submit-heading").textContent = meta.over ? "Game over!" : "You got De La Salle!";
    $(".submit-points").textContent = Number(meta.score).toLocaleString();

    var already = submitted[meta.seed];
    $(".submit-button").disabled = already === meta.score;
    if (already === meta.score) {
      setStatus("Score submitted. <a href=\"#leaderboard\">See the leaderboard</a>");
    } else {
      setStatus("");
    }

    panel.classList.add("visible");
  }

  function submitScore(event) {
    event.preventDefault();
    if (!currentRun || submitting) return;

    var input = $(".player-name");
    var name = input.value.replace(/\s+/g, " ").trim();
    if (!name) {
      setStatus("Enter a name first.", true);
      input.focus();
      return;
    }
    store.set(NAME_KEY, name);

    var run = currentRun;
    submitting = true;
    $(".submit-button").disabled = true;
    setStatus("Submitting…");

    fetch(API_SUBMIT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ name: name, seed: run.seed, moves: run.moves, score: run.score })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw new Error(body.error || ("Error " + r.status));
          return body;
        });
      })
      .then(function (body) {
        submitted[run.seed] = run.score;
        if (body.id) rememberRun(body.id, body.score);
        lastLoad = 0; // refresh next time the tab opens
        var rankText = body.rank ? "You're <strong>#" + body.rank + "</strong> on the leaderboard! " : "Score submitted! ";
        setStatus(rankText + "<a href=\"#leaderboard\">See the leaderboard</a>");
      })
      .catch(function (err) {
        $(".submit-button").disabled = false;
        setStatus(err.message, true);
      })
      .then(function () { submitting = false; });
  }

  // ------------------------------------------------------------- setup
  function init() {
    var tabs = document.querySelectorAll(".tabs .tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener("click", function (event) {
        event.preventDefault();
        var name = this.getAttribute("data-tab");
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", name === "leaderboard" ? "#leaderboard" : window.location.pathname + window.location.search);
        } else {
          window.location.hash = name;
        }
        showTab(name);
        this.blur();
      });
    }
    window.addEventListener("hashchange", function () { showTab(tabFromHash()); });

    $(".refresh-button").addEventListener("click", function (event) {
      event.preventDefault();
      loadLeaderboard(true);
    });

    var input = $(".player-name");
    input.value = store.get(NAME_KEY) || "";
    $(".submit-form").addEventListener("submit", submitScore);

    showTab(tabFromHash());
  }

  window.EBALLeaderboard = { onGameState: onGameState, refresh: function () { loadLeaderboard(true); } };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
