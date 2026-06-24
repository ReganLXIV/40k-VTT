import type { Layout, Point, Token } from '@shared/types';
import { mmToInches, RESERVE_W } from './coords';

// Hit-test tokens in canonical inch space. Returns topmost (last drawn) match.
export function tokenAt(p: Point, tokens: Token[]): Token | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    const r = Math.max(mmToInches(t.baseMm) / 2, 0.35);
    if (Math.hypot(t.x - p.x, t.y - p.y) <= r) return t;
  }
  return null;
}

export function objectiveAt(p: Point, layout: Layout): string | null {
  for (const o of layout.objectives) {
    if (Math.hypot(o.cx - p.x, o.cy - p.y) <= Math.max(o.radiusInch, 1.5)) return o.id;
  }
  return null;
}

// Clamp to the board PLUS the reserve strips on each side (so tokens can be
// dragged off the battlefield into reserves). Y stays within the board.
export function clampToBoard(p: Point, layout: Layout): Point {
  return {
    x: Math.max(-RESERVE_W, Math.min(layout.width + RESERVE_W, p.x)),
    y: Math.max(0, Math.min(layout.height, p.y)),
  };
}
