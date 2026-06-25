import type { Point } from '@shared/types';

// Reserve strip width (inches) on each side of the board, off the battlefield.
export const RESERVE_W = 9;

export interface ViewParams {
  scale: number; // pixels per inch
  offsetX: number; // px to the leftmost drawable canonical x (-marginX)
  offsetY: number; // px padding top
  boardWidth: number; // inches
  boardHeight: number; // inches
  marginX: number; // reserve strip width per side (inches)
  flip: boolean;
}

// Fit the board PLUS a reserve strip on each side into the viewport.
export function computeView(
  boardWidth: number,
  boardHeight: number,
  pxW: number,
  pxH: number,
  flip: boolean,
  pad = 24,
  marginX = RESERVE_W
): ViewParams {
  const availW = pxW - pad * 2;
  const availH = pxH - pad * 2;
  const effW = boardWidth + marginX * 2;
  const scale = Math.max(1, Math.min(availW / effW, availH / boardHeight));
  const drawnW = effW * scale;
  const drawnH = boardHeight * scale;
  const offsetX = (pxW - drawnW) / 2;
  const offsetY = (pxH - drawnH) / 2;
  return { scale, offsetX, offsetY, boardWidth, boardHeight, marginX, flip };
}

// Apply the per-client 180° view transform in CANONICAL inch space.
// Player 2 (flip=true) sees the board rotated so their zone is at the bottom.
export function applyViewTransform(p: Point, v: ViewParams): Point {
  if (!v.flip) return p;
  return { x: v.boardWidth - p.x, y: v.boardHeight - p.y };
}

export function invertViewTransform(p: Point, v: ViewParams): Point {
  // 180° rotation is its own inverse.
  return applyViewTransform(p, v);
}

// canonical inches -> screen pixels (includes flip + reserve margin)
export function inchesToPx(p: Point, v: ViewParams): Point {
  const t = applyViewTransform(p, v);
  return { x: v.offsetX + (t.x + v.marginX) * v.scale, y: v.offsetY + t.y * v.scale };
}

// screen pixels -> canonical inches (includes inverse flip + reserve margin)
export function pxToInches(px: Point, v: ViewParams): Point {
  const viewSpace = {
    x: (px.x - v.offsetX) / v.scale - v.marginX,
    y: (px.y - v.offsetY) / v.scale,
  };
  return invertViewTransform(viewSpace, v);
}

export function mmToInches(mm: number): number {
  return mm / 25.4;
}

// Draw a full circle, but never pass a negative/NaN radius to ctx.arc (which
// throws "The radius provided is negative" and would kill the render loop).
export function fullArc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number
): void {
  if (Number.isFinite(r) && r > 0) ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
