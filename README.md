# GetDLS

GetDLS is a version of [GetMIT](https://mitchgu.github.io/GetMIT/) for the East Bay Athletic League. It keeps GetMIT's layout, colors and fonts, uses school tiles instead of number tiles, and adds a leaderboard tab with a global top-100 list.

**Tile order** (two of a tile merge into the next one):

| Tile | School | | Tile | School |
|---|---|---|---|---|
| 2 | Dougherty Valley | | 512 | San Ramon Valley |
| 4 | Foothill | | 1024 | Carondelet |
| 8 | Dublin | | 2048 | **De La Salle** (you win) |
| 16 | Livermore | | 4096 | Cook (DLS house) |
| 32 | Granada | | 8192 | Reedley (DLS house) |
| 64 | Monte Vista | | 16384 | Grove (DLS house) |
| 128 | Amador Valley | | 32768 | Odyssey (DLS house) |
| 256 | California | | 65536+ | **IHTFP** |

The order follows the EBAL rankings in the hsratings.com 2025 East Bay power ratings, from lowest to highest. Carondelet is not in those football ratings because it is a girls' school, so it sits one step below De La Salle. Only the 11 full EBAL members are included; the supplemental badminton schools (Emerald and Quarry Lane) are left out. The logos come from the [EBAL school directory](https://theebal.com/School_Directory).

## Deploy for free on Vercel (about 5 minutes)

Nothing here costs money. The site runs on Vercel's free **Hobby** plan, and the leaderboard is stored in **Upstash Redis** on its free plan.

1. **Put the code on GitHub.** Create a new repository, then upload the contents of this folder to it.
2. **Import it into Vercel.** Go to vercel.com → *Add New… → Project* → choose the repository. Leave the Framework Preset on **Other** and leave the build settings empty. Click **Deploy**.
3. **Add the leaderboard database.** In the Vercel project, open the **Storage** tab → **Create Database** → **Upstash** → **Upstash for Redis**. Pick the **Free** plan and a region close to your users (for example `us-west-1`), then connect it to the project for all environments. Vercel adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables for you.
4. **Redeploy.** Go to **Deployments**, open the ⋯ menu on the latest one and choose **Redeploy**, so the site picks up the new variables.

The site is now live, and the leaderboard tab works.

> You can also create the database at upstash.com instead. In that case, add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel → Settings → Environment Variables. Both naming styles work.

## How the leaderboard prevents faked scores

Each game starts from a random seed, and the game records every move. When a player submits a score, `/api/submit` replays the whole game on the server using the same game code (`js/game_manager.js`) and saves only the score that replay produces. As a result:

- an edited score, an edited move list or a made-up game is rejected;
- a game can be submitted once it ends, or as soon as the player reaches De La Salle. If the player then keeps going, they can submit the same game again with the higher score;
- each IP address can submit at most 15 times per minute, and names containing obvious profanity are rejected.

## Resetting the leaderboard

The leaderboard is stored under a version name in `api/_lib/common.js` (currently `getdls:v2`). To start with an empty leaderboard, change it to `getdls:v3` and push. Old scores stay in the database, so changing the name back restores them.

## Moderation (optional)

To remove leaderboard entries, add an environment variable named `ADMIN_TOKEN` in Vercel, set it to any long secret, and redeploy. After that:

```bash
# Every entry's "id" appears in https://YOUR-SITE.vercel.app/api/leaderboard
curl -X POST https://YOUR-SITE.vercel.app/api/admin \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"remove","id":"ENTRY_ID"}'

# Remove every entry with a given name
  -d '{"action":"remove-name","name":"Some Name"}'

# Wipe the leaderboard
  -d '{"action":"reset","confirm":"RESET"}'
```

## Files

```
index.html               page layout (GetMIT's, plus the tabs and the leaderboard)
style/main.css           GetMIT's stylesheet with the school tiles, plus the leaderboard styles
img/                     school logos and the IHTFP tile
js/game_manager.js       game rules (seeded, records moves; also used by the server)
js/rng.js                seeded random numbers shared by the browser and the server
js/leaderboard.js        tabs, score submission and the leaderboard table
api/leaderboard.js       GET  top 100 scores
api/submit.js            POST a finished game (replayed and verified)
api/admin.js             optional moderation
vercel.json              ships the game code with the API functions
```

## Changing the school order

If you want a different order, change three places so they stay in sync:

- the `.tile.tile-N` image URLs in `style/main.css`;
- `TILE_IMAGES` and `TILE_NAMES` in `js/leaderboard.js`;
- the IHTFP cut-off (`tile.value > 32768`) in `js/html_actuator.js` and `js/leaderboard.js`, if the last tile changes;
- the school list at the bottom of the game section in `index.html`.

## Credits

This project is based on GetMIT by Mitchell Gu, which was inspired by Get Caltech by Naveen Arun. All of these are based on 2048 by Gabriele Cirulli (MIT License, see `LICENSE.txt`). The school logos belong to their schools. This project is not affiliated with the EBAL.
