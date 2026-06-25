import type { Layout, TerrainArea } from './types.js';

// The terrain footprint an objective marker sits on: the piece whose area
// contains the marker's centre. The whole footprint acts as the objective zone.
export function objectiveFootprint(
  o: { cx: number; cy: number },
  layout: Layout
): TerrainArea | undefined {
  return layout.terrain.find((t) => pointInTerrain(o.cx, o.cy, t));
}

export function pointInTerrain(px: number, py: number, t: TerrainArea): boolean {
  if (t.shape === 'rect') {
    const [x, y, w, h] = t.geom;
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }
  if (t.shape === 'circle') {
    const [cx, cy, r] = t.geom;
    return Math.hypot(px - cx, py - cy) <= r;
  }
  if (t.shape === 'triangle') {
    return pointInTriangle(px, py, t.geom);
  }
  return false;
}

// Does a model base (centre + radius, inches) touch a terrain footprint? True if
// the base circle overlaps the footprint (it does NOT have to be wholly inside).
export function baseTouchesTerrain(
  cx: number,
  cy: number,
  baseRin: number,
  t: TerrainArea
): boolean {
  if (pointInTerrain(cx, cy, t)) return true;
  if (t.shape === 'rect') {
    const [x, y, w, h] = t.geom;
    const nx = Math.max(x, Math.min(cx, x + w));
    const ny = Math.max(y, Math.min(cy, y + h));
    return Math.hypot(cx - nx, cy - ny) <= baseRin;
  }
  if (t.shape === 'circle') {
    const [tx, ty, r] = t.geom;
    return Math.hypot(cx - tx, cy - ty) <= r + baseRin;
  }
  if (t.shape === 'triangle') {
    // approximate: distance from the centre to the nearest edge
    const [x0, y0, x1, y1, x2, y2] = t.geom;
    const d = Math.min(
      segDist(cx, cy, x0, y0, x1, y1),
      segDist(cx, cy, x1, y1, x2, y2),
      segDist(cx, cy, x2, y2, x0, y0)
    );
    return d <= baseRin;
  }
  return false;
}

function pointInTriangle(px: number, py: number, g: number[]): boolean {
  const [x0, y0, x1, y1, x2, y2] = g;
  const d1 = sign(px, py, x0, y0, x1, y1);
  const d2 = sign(px, py, x1, y1, x2, y2);
  const d3 = sign(px, py, x2, y2, x0, y0);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}
function sign(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
}
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
