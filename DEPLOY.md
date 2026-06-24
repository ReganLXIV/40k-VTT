# Deploying to Railway

This app is a single Node service: the Express/Socket.IO server also serves the
built React client and reads the prebuilt SQLite stat DB. No external database or
add-ons are required.

## What ships in the repo
- `data/stats.sqlite` — the prebuilt stat DB (all 25 factions, ~1700 datasheets).
  It is committed so the deployed container has stats without re-ingesting.
- `data/layouts/*.json` — the 47 deployment maps.
- The Wahapedia CSVs (`data/wahapedia/`) are **git-ignored** — only needed to
  rebuild the DB locally with `npm run ingest`.

## Config already in place
- `package.json` → `engines.node = ">=24.0.0"` and `.nvmrc = 24` (the built-in
  `node:sqlite` module needs Node 24).
- `railway.json` → build `npm run build`, start `npm start`.
- The server listens on `process.env.PORT` (Railway injects it) and binds all
  interfaces. The client connects same-origin, so no URL env vars are needed.

## Deploy — option A: GitHub (recommended)
1. Create a new GitHub repo and push:
   ```bash
   git remote add origin https://github.com/<you>/40k-vtt.git
   git push -u origin main
   ```
2. In Railway: **New Project → Deploy from GitHub repo** → pick the repo.
3. Railway auto-detects Nixpacks, runs `npm run build`, then `npm start`.
4. Open **Settings → Networking → Generate Domain** to get a public URL.

## Deploy — option B: Railway CLI (no GitHub)
```bash
npm i -g @railway/cli
railway login
railway init
railway up
railway domain   # generate a public URL
```

## After deploy
- Two players open the URL, one **Creates a room** and shares the 5-letter code;
  the other **Joins**. A **Watch** (spectator) link is also available.
- To update stats later: locally run `npm run ingest` (with the CSVs present),
  commit the new `data/stats.sqlite`, and push — Railway redeploys.

## Notes / limits
- Room state is **in memory** — a redeploy or crash clears active rooms. Fine for
  testing; add persistence later if needed.
- Free Railway instances sleep when idle; the first request after idle is slow.
