/**
 * Generates the Strike Force "Force Disposition" layouts from the Warhammer Event
 * Companion. All 15 disposition matchups (the 5 Force Dispositions — Take and Hold,
 * Purge the Foe, Disruption, Reconnaissance, Priority Assets — paired with
 * repetition) on the shared, reproduced "Layout A" terrain. Board is portrait
 * 44" x 60". Deployment-zone shapes are read by eye from the Event Companion
 * deployment maps (pages 9-53) — published *measurements* (facts), not artwork.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../data/layouts');
const W = 44;
const H = 60;

// Accurate "Layout A" ruin footprints, auto-detected from the Event Companion
// deployment map (page 9) and enforced 180°-rotationally symmetric. Top-half +
// centre pieces are defined here; bottom-half pieces are their 180° mirrors.
const mirrorRect = (g: number[]): number[] => [W - g[0] - g[2], H - g[1] - g[3], g[2], g[3]];

const topPieces: { id: string; geom: number[]; label?: string }[] = [
  { id: 'ruin_top_c', geom: [14, 8.2, 7.5, 10.5] }, // red home ruin
  { id: 'ruin_top_cr', geom: [26.3, 10.5, 6.5, 3.9] },
  { id: 'ruin_top_r', geom: [32.4, 14.6, 7.5, 10.5] },
  { id: 'pipe_tl', geom: [2.1, 15, 9.9, 3.3], label: 'Barricade' },
  { id: 'barr_top', geom: [20.8, 18.5, 7.3, 2.5], label: 'Barricade' },
  { id: 'ruin_ml', geom: [3.8, 22.2, 8.7, 8.2] },
];
const centrePiece = { id: 'ruin_centre', geom: [16, 24.7, 12, 10.6] }; // single large central ruin

const terrain = [
  ...topPieces.map((p) => ({ id: p.id, shape: 'rect', geom: p.geom, label: p.label ?? 'Ruin', obscuring: !p.label })),
  { id: centrePiece.id, shape: 'rect', geom: centrePiece.geom, label: 'Ruin', obscuring: true },
  ...topPieces.map((p) => ({
    id: p.id + '_m',
    shape: 'rect',
    geom: mirrorRect(p.geom),
    label: p.label ?? 'Ruin',
    obscuring: !p.label,
  })),
];

const objectives = [
  { id: 'obj_home_p2', cx: 17, cy: 14, type: 'home', radiusInch: 3, controlledBy: null },
  { id: 'obj_home_p1', cx: 27, cy: 46, type: 'home', radiusInch: 3, controlledBy: null },
  { id: 'obj_exp_r', cx: 36, cy: 20, type: 'expansion', radiusInch: 3, controlledBy: null },
  { id: 'obj_exp_l', cx: 8, cy: 40, type: 'expansion', radiusInch: 3, controlledBy: null },
  { id: 'obj_central', cx: 22, cy: 30, type: 'central', radiusInch: 3, controlledBy: null },
];

// player2 (top/red) zone polygons by archetype; player1 is the 180° rotation.
const ARCH: Record<string, number[]> = {
  bands_tb: [0, 0, W, 0, W, 14, 0, 14],
  bands_tb_ang: [0, 0, W, 0, W, 12, 0, 20], // page 9: red 12" right, 20" left
  bands_lr: [0, 0, 14, 0, 14, H, 0, H],
  bands_lr_ang: [0, 0, 14, 0, 8, H, 0, H],
  diag: [0, 0, W, 0, W, 12, 0, 20],
  diag_rev: [0, 0, W, 0, W, 20, 0, 12],
  half: [0, 0, W, 0, 0, H],
  quarters: [0, 0, 22, 0, 22, 30, 0, 30],
};

function mirror(poly: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < poly.length; i += 2) {
    out.push(W - poly[i], H - poly[i + 1]);
  }
  return out;
}

// 15 matchups: [Force Disposition A, Force Disposition B, deployment archetype]
const matchups: [string, string, keyof typeof ARCH][] = [
  ['Take and Hold', 'Take and Hold', 'bands_tb_ang'],
  ['Take and Hold', 'Purge the Foe', 'bands_lr_ang'],
  ['Take and Hold', 'Disruption', 'half'],
  ['Take and Hold', 'Reconnaissance', 'bands_tb'],
  ['Take and Hold', 'Priority Assets', 'diag'],
  ['Purge the Foe', 'Purge the Foe', 'diag_rev'],
  ['Purge the Foe', 'Disruption', 'bands_lr'],
  ['Purge the Foe', 'Reconnaissance', 'bands_tb_ang'],
  ['Purge the Foe', 'Priority Assets', 'quarters'],
  ['Disruption', 'Disruption', 'diag'],
  ['Disruption', 'Reconnaissance', 'diag_rev'],
  ['Disruption', 'Priority Assets', 'bands_lr'],
  ['Reconnaissance', 'Reconnaissance', 'bands_tb'],
  ['Reconnaissance', 'Priority Assets', 'diag'],
  ['Priority Assets', 'Priority Assets', 'diag_rev'],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

for (const f of fs.readdirSync(OUT)) {
  if (f.startsWith('strike_force_')) fs.rmSync(path.join(OUT, f));
}

for (const [a, b, arch] of matchups) {
  const p2 = ARCH[arch];
  const p1 = mirror(p2);
  const id = `sf_${slug(a)}__${slug(b)}`;
  const layout = {
    id,
    name: `${a} vs ${b}`,
    boardSize: 'strike_force',
    width: W,
    height: H,
    terrain,
    objectives,
    deploymentZones: [
      { player: 'player2', polygon: p2 },
      { player: 'player1', polygon: p1 },
    ],
  };
  fs.writeFileSync(path.join(OUT, `strike_force_${slug(a)}_v_${slug(b)}.json`), JSON.stringify(layout, null, 2));
  console.log('wrote', layout.name, `(${arch})`);
}
console.log(`done — ${matchups.length} Force Disposition layouts`);
