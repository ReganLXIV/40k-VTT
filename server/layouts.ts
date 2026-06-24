import fs from 'node:fs';
import path from 'node:path';
import type { Layout } from '../shared/types.js';
import { LAYOUT_DIR } from './paths.js';

let cache: Layout[] | null = null;

export function loadLayouts(): Layout[] {
  if (cache) return cache;
  const out: Layout[] = [];
  if (fs.existsSync(LAYOUT_DIR)) {
    for (const f of fs.readdirSync(LAYOUT_DIR)) {
      if (!f.endsWith('.json')) continue;
      try {
        const layout = JSON.parse(
          fs.readFileSync(path.join(LAYOUT_DIR, f), 'utf-8')
        ) as Layout;
        out.push(layout);
      } catch (e) {
        console.warn(`[layouts] failed to parse ${f}:`, e);
      }
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  cache = out;
  return out;
}

export function getLayoutById(id: string): Layout | null {
  return loadLayouts().find((l) => l.id === id) ?? null;
}

export function getDefaultLayout(): Layout {
  const layouts = loadLayouts();
  return (
    layouts.find((l) => l.id === 'sf_take_and_hold__take_and_hold__a') ??
    layouts.find((l) => l.boardSize === 'strike_force') ??
    layouts[0] ??
    fallbackLayout()
  );
}

function fallbackLayout(): Layout {
  return {
    id: 'fallback_strike_force',
    name: 'Strike Force (blank)',
    boardSize: 'strike_force',
    width: 60,
    height: 44,
    terrain: [],
    objectives: [
      { id: 'o1', cx: 30, cy: 22, type: 'central', radiusInch: 3, controlledBy: null },
    ],
    deploymentZones: [
      { player: 'player1', polygon: [0, 32, 60, 32, 60, 44, 0, 44] },
      { player: 'player2', polygon: [0, 0, 60, 0, 60, 12, 0, 12] },
    ],
  };
}
