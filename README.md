# 40K VTT — Assisted Virtual Tabletop (11th edition)

A web app that imports a New Recruit army list, hydrates each unit with datasheet
stats, and drops both players into a shared, real-time top-down battlefield with
dice, rulers, terrain, objectives, and deployment zones.

It **assists** (tracks wounds, models, objectives, stats and rolls dice) but does
**not enforce** rules — players move freely and resolve combat manually, exactly
like a physical game over a video call. Player 2 sees the board flipped 180°.

> Unofficial fan tool. Not affiliated with or endorsed by Games Workshop. No GW
> artwork or rules text is reproduced. Terrain layouts are plain geometric shapes
> at published *measurements* (facts). Datasheet stats come from the community
> **[40kdc-data](https://github.com/wn-mitch/40kdc-data)** project (11th edition,
> CC BY 4.0) — credited in the app footer.

---

## Quick start

```bash
npm install

# Build the stat database. Pick ONE:
npm run seed          # small SAMPLE data — works immediately, placeholder stats
# or
npm run ingest:40kdc  # real 11th-edition stats from 40kdc-data (see below) — recommended
# or
npm run ingest        # 10th-edition stats from a local Wahapedia CSV export

npm run dev       # server :3001 + client :5173 (open http://localhost:5173)
```

Open two browser tabs (or two machines): **Create room** in one, copy the 5-char
code, **Join** with it in the other.

## Production

```bash
npm run build     # builds client -> client/dist and server -> dist/
npm start         # single Node process serves the app + WebSocket on $PORT (default 3001)
```

Deploy as a single web service (Railway / Render). Set `PORT` if the platform
requires it. Run `npm run ingest` (or `seed`) during the build so `data/stats.sqlite`
exists before `npm start`. Rooms are in-memory and reset on restart (by design).

---

## Getting the datasheet data (real stats)

### Recommended: 40kdc-data (11th edition)

```bash
npm run ingest:40kdc      # stop the dev server first — Windows locks stats.sqlite
node scripts/gen-detachment-points.mjs   # refresh per-detachment DP costs
```

`ingest:40kdc` fetches structured 11th-edition JSON straight from the
[40kdc-data](https://github.com/wn-mitch/40kdc-data) repo on GitHub (no manual
download) and rebuilds `data/stats.sqlite`: datasheet stat lines, points, base
sizes, weapon profiles, keywords, and the detachment / stratagem / enhancement
lists (names + CP + phase + DP) for every faction, including Space Marine
chapters. The community's ability/stratagem *effects* are a machine-readable DSL,
not prose, so effect text is left blank — the in-app editor and
`client/src/data/detachments11e.ts` overrides fill that in. The data is CC BY 4.0;
the attribution is shown in the app footer.

Committing the rebuilt `data/stats.sqlite` is what ships the new data to
production (the Railway build does not re-ingest).

### Alternate: Wahapedia CSV export (10th edition)

There is **no live API**. Download the Wahapedia CSV data export and place the files
in `data/wahapedia/`. Per the Wahapedia "Export Data Specs", these are **`|`
(vertical-bar) delimited, UTF-8** files (not semicolons), and text fields contain
HTML — the ingest handles both. Files used:

- `Factions.csv`
- `Datasheets.csv`
- `Datasheets_models.csv`
- `Datasheets_wargear.csv`
- `Datasheets_abilities.csv`
- `Abilities.csv` (master ability text; some datasheet abilities reference it by id)
- `Datasheets_keywords.csv`

Then (with the dev server **stopped** — on Windows it locks `stats.sqlite`):

```bash
npm run ingest
```

The ingest script is **column-name driven** (maps fields by header, tolerant of
column-order drift), strips HTML from descriptions, resolves abilities linked by
`ability_id` to `Abilities.csv`, and rebuilds `data/stats.sqlite` from scratch. By
default it ingests **all factions**; set `INGEST_XENOS_ONLY=1` to limit it to the
Xenos factions. It prints per-faction counts and warns about any datasheet missing
model profiles or weapons.

### Refreshing to a new dataslate

Both importers write the same schema via `scripts/dbBuild.ts`, so refreshing is
data-only. For the 40kdc source, re-run `npm run ingest:40kdc` (it always pulls
the latest from GitHub) then `node scripts/gen-detachment-points.mjs`, and commit
the rebuilt `data/stats.sqlite` + regenerated `detachmentPoints.ts`.

`client/src/data/detachmentPoints.ts` is **auto-generated** from the import (DP per
detachment for every faction). Hand-entered 11th-ed detachment *effect* overrides
live in `client/src/data/detachments11e.ts`, and per-user in-app edits are saved to
localStorage — the Detachment panel resolves user edit → 11e override → import.

---

## Project layout

```
40k-vtt/
├── data/layouts/           # committed preset layout JSON
├── scripts/
│   ├── ingest-40kdc.ts     # 40kdc-data JSON (11th ed) -> stats.sqlite
│   ├── ingest-wahapedia.ts # Wahapedia CSV (10th ed) -> stats.sqlite
│   ├── hullSizes.ts        # shared vehicle hull footprints
│   ├── gen-detachment-points.mjs # stats.sqlite -> detachmentPoints.ts
│   ├── seed-sample.ts      # sample stats.sqlite (no download needed)
│   └── dbBuild.ts          # shared schema + insert layer
├── server/                 # Express + Socket.IO + SQLite
├── shared/types.ts         # types shared client <-> server
└── client/                 # React + Vite + Canvas board
```

## How it works

- **Coordinates** are canonical inches, origin at one corner. The server stores one
  unflipped state; each client applies its own view transform. Player 2 renders with
  a 180° rotation (`x' = W-x, y' = H-y`) so both see their own deployment zone at the
  bottom. Input is inverted through the same transform.
- **Server is authoritative.** Clients send intents (move token, set wounds, roll
  dice, control objective…); the server applies them with no rules validation and
  rebroadcasts full state. Dice are rolled server-side so neither player can fudge.
- **Rooms** are in-memory, joined by a short ambiguity-free code, reaped after being
  empty for 30 minutes.

## npm scripts

| script | what |
|--------|------|
| `npm run dev` | server + client with hot reload |
| `npm run seed` | build sample `stats.sqlite` |
| `npm run ingest:40kdc` | build `stats.sqlite` from 40kdc-data (11th ed) |
| `npm run ingest` | build `stats.sqlite` from Wahapedia CSVs (10th ed) |
| `npm run build` | build client and server for production |
| `npm start` | run the built single-process server |
```
