/**
 * Regenerates client/src/data/detachmentPoints.ts from the built stats.sqlite.
 *
 * The 40kdc import (npm run ingest:40kdc) writes each detachment's DP cost into
 * detachment_ability.description as "<n> DP". This lifts those into a static map
 * the client can use for the Detachment Points budget without a round-trip.
 *
 *   Run (after ingest):  node scripts/gen-detachment-points.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(__dirname, '../data/stats.sqlite');
const OUT = path.resolve(__dirname, '../client/src/data/detachmentPoints.ts');

const db = new DatabaseSync(DB);
const rows = db
  .prepare(
    "SELECT faction_name, detachment, description FROM detachment_ability WHERE description LIKE '% DP' ORDER BY faction_name, detachment"
  )
  .all();
const map = {};
for (const r of rows) {
  const dp = parseInt(String(r.description), 10);
  if (!Number.isFinite(dp) || !r.detachment) continue;
  (map[r.faction_name] ??= {})[r.detachment] = dp;
}
db.close();

const out = `// AUTO-GENERATED from the 40kdc-data import (npm run ingest:40kdc) — Detachment
// Points cost per detachment for every 11th-edition faction. Regenerate with
// scripts/gen-detachment-points.mjs after re-ingesting. Keyed by faction display
// name, then detachment name (both exactly as they appear in the datasheet API).

export const DETACHMENT_DP: Record<string, Record<string, number>> = ${JSON.stringify(map, null, 2)};

// Look up a detachment's DP cost. Case-insensitive on both faction and name so a
// stored selection still resolves if capitalisation drifts.
export function detachmentDP(faction: string | undefined, name: string): number | undefined {
  if (!faction) return undefined;
  const fk = Object.keys(DETACHMENT_DP).find((k) => k.toLowerCase() === faction.toLowerCase());
  if (!fk) return undefined;
  const dets = DETACHMENT_DP[fk];
  const nk = Object.keys(dets).find((k) => k.toLowerCase() === name.toLowerCase());
  return nk ? dets[nk] : undefined;
}
`;
fs.writeFileSync(OUT, out);
console.log(`[gen-dp] wrote ${OUT} (${Object.keys(map).length} factions)`);
