import type { PlayerSlot, RoomState, Token } from '@shared/types';
import { objectiveFootprint } from '@shared/objectives';
import {
  type ViewParams,
  inchesToPx,
  mmToInches,
  fullArc,
} from './coords';

const P1 = '#4ea1ff';
const P2 = '#ff5d5d';
const OBJ_COLORS = { home: '#9b8cff', expansion: '#ffb454', central: '#5ad17a' };

function ownerColor(o: PlayerSlot): string {
  return o === 'player1' ? P1 : P2;
}

// Count a polygon's distinct vertices that fall within `reach` inches of a point.
// Diagonal/quarters deployment layouts wrap each player's zone around the board
// centre, so each player contributes *two* corners near it; straight long/short-
// edge splits and stepped splits give each player only one. Counting per player
// (rather than overall distance) is what separates the two families.
function vertsWithin(cx: number, cy: number, poly: number[], reach: number): number {
  const seen = new Set<string>();
  for (let i = 0; i < poly.length; i += 2) {
    const x = poly[i], y = poly[i + 1];
    if (Math.hypot(x - cx, y - cy) <= reach) seen.add(`${Math.round(x)},${Math.round(y)}`);
  }
  return seen.size;
}

export interface RenderInput {
  ctx: CanvasRenderingContext2D;
  v: ViewParams;
  state: RoomState;
  mySlot: PlayerSlot | 'spectator' | null;
  selectedTokenId: string | null;
  showGrid: boolean;
  liveRuler: { a: { x: number; y: number }; b: { x: number; y: number } } | null;
  showRanges?: boolean;
  showDeployAid?: boolean;
  rangeRingInch?: number;
  // the token currently being dragged + where it was picked up (canonical inches),
  // so we can show its Move-stat reach from the origin and flag over-moves.
  drag?: { id: string; start: { x: number; y: number } } | null;
  dpr: number;
}

export function renderBoard(input: RenderInput) {
  const { ctx, v, state, mySlot, selectedTokenId, showGrid, liveRuler } = input;
  const { layout } = state;

  ctx.save();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // board background
  const tl = inchesToPx({ x: 0, y: 0 }, v);
  const br = inchesToPx({ x: layout.width, y: layout.height }, v);
  const bx = Math.min(tl.x, br.x);
  const by = Math.min(tl.y, br.y);
  const bw = Math.abs(br.x - tl.x);
  const bh = Math.abs(br.y - tl.y);
  ctx.fillStyle = '#1a2b1f';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#3c5a44';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);

  // reserve strips (off-battlefield) on each side of the board
  for (const side of [-1, 1] as const) {
    const x0 = side < 0 ? -v.marginX : layout.width;
    const a = inchesToPx({ x: x0, y: 0 }, v);
    const b = inchesToPx({ x: x0 + v.marginX, y: layout.height }, v);
    const rx = Math.min(a.x, b.x), ry = Math.min(a.y, b.y);
    const rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y);
    ctx.fillStyle = 'rgba(28,34,42,0.92)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#2c3543';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.save();
    ctx.translate(rx + rw / 2, ry + rh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(154,164,178,0.55)';
    ctx.font = `bold ${Math.max(11, v.scale * 1.1)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RESERVES', 0, 0);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // grid
  if (showGrid) {
    ctx.lineWidth = 1;
    for (let i = 0; i <= layout.width; i += 6) {
      const a = inchesToPx({ x: i, y: 0 }, v);
      const b = inchesToPx({ x: i, y: layout.height }, v);
      ctx.strokeStyle = i % 12 === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)';
      line(ctx, a, b);
    }
    for (let j = 0; j <= layout.height; j += 6) {
      const a = inchesToPx({ x: 0, y: j }, v);
      const b = inchesToPx({ x: layout.width, y: j }, v);
      ctx.strokeStyle = j % 12 === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)';
      line(ctx, a, b);
    }
  }

  // Deployment zones. Only diagonal / quarters layouts — where both players' zones
  // wrap around the board centre, each contributing two corners near it — get the
  // central 9" no-deploy circle carved out so their boundaries curve inwards.
  // Plain or stepped long/short-edge splits (one corner per player near centre)
  // stay as flat zones.
  const CENTRE_NO_DEPLOY = 9; // inches
  const CARVE_VERTEX_REACH = 11; // a zone corner within this of centre = "reaching" the centre
  const centreIn = { x: layout.width / 2, y: layout.height / 2 };
  const wrapping = layout.deploymentZones.filter(
    (dz) => vertsWithin(centreIn.x, centreIn.y, dz.polygon, CARVE_VERTEX_REACH) >= 2
  ).length;
  const carve = wrapping >= 2;
  const centrePx = inchesToPx(centreIn, v);
  const carveR = CENTRE_NO_DEPLOY * v.scale;
  const clipOutsideCircle = () => {
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.moveTo(centrePx.x + carveR, centrePx.y);
    ctx.arc(centrePx.x, centrePx.y, carveR, 0, Math.PI * 2);
    ctx.clip('evenodd');
  };
  for (const dz of layout.deploymentZones) {
    const mine = dz.player === mySlot;
    const c = ownerColor(dz.player);
    const buildPoly = () => {
      ctx.beginPath();
      for (let i = 0; i < dz.polygon.length; i += 2) {
        const p = inchesToPx({ x: dz.polygon[i], y: dz.polygon[i + 1] }, v);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    };
    ctx.fillStyle = hexA(c, mine ? 0.16 : 0.08);
    ctx.strokeStyle = hexA(c, 0.5);
    ctx.lineWidth = mine ? 2 : 1;
    if (carve) {
      // fill and outline clipped to outside the central circle → curved boundary
      ctx.save();
      clipOutsideCircle();
      buildPoly();
      ctx.fill();
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else {
      buildPoly();
      ctx.fill();
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Which terrain footprints are objectives, and who controls each — the whole
  // footprint is the objective zone and is tinted with the controller's colour.
  const footControl: Record<string, PlayerSlot> = {};
  for (const o of layout.objectives) {
    const foot = objectiveFootprint(o, layout);
    const ctrl = state.objectives[o.id] ?? null;
    if (foot && ctrl) footControl[foot.id] = ctrl;
  }

  // terrain
  for (const t of layout.terrain) {
    const ctrl = footControl[t.id];
    ctx.fillStyle = ctrl ? hexA(ownerColor(ctrl), 0.34) : 'rgba(120,130,140,0.18)';
    ctx.strokeStyle = ctrl ? ownerColor(ctrl) : 'rgba(200,210,220,0.55)';
    ctx.lineWidth = ctrl ? 2.5 : 1.5;
    ctx.beginPath();
    if (t.shape === 'rect') {
      const [x, y, w, h] = t.geom;
      const corners = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ].map((p) => inchesToPx(p, v));
      poly(ctx, corners);
    } else if (t.shape === 'triangle') {
      const pts = [
        { x: t.geom[0], y: t.geom[1] },
        { x: t.geom[2], y: t.geom[3] },
        { x: t.geom[4], y: t.geom[5] },
      ].map((p) => inchesToPx(p, v));
      poly(ctx, pts);
    } else if (t.shape === 'circle') {
      const [cx, cy, r] = t.geom;
      const c = inchesToPx({ x: cx, y: cy }, v);
      fullArc(ctx, c.x, c.y, r * v.scale);
    }
    ctx.fill();
    ctx.stroke();
    if (t.obscuring) hatch(ctx, t, v);
  }

  // ruin detail (line-of-sight): teal foliage areas, then gold wall shapes — drawn
  // as polygons at their real positions.
  const fillPoly = (flat: number[], color: string) => {
    if (flat.length < 6) return;
    ctx.beginPath();
    for (let i = 0; i < flat.length; i += 2) {
      const p = inchesToPx({ x: flat[i], y: flat[i + 1] }, v);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  if (layout.details) {
    for (const d of layout.details) if (d.kind === 'foliage') fillPoly(d.geom, 'rgba(40,170,148,0.5)');
    for (const d of layout.details) if (d.kind === 'wall') fillPoly(d.geom, 'rgba(214,168,74,0.92)');
  }

  // objectives: the controlled footprint is already tinted above. Only draw a
  // small marker for objectives that aren't sitting on a terrain footprint.
  for (const o of layout.objectives) {
    if (objectiveFootprint(o, layout)) continue;
    const c = inchesToPx({ x: o.cx, y: o.cy }, v);
    const controller = state.objectives[o.id] ?? null;
    ctx.beginPath();
    fullArc(ctx, c.x, c.y, Math.max(6, v.scale * 0.7));
    ctx.fillStyle = controller ? ownerColor(controller) : OBJ_COLORS[o.type];
    ctx.fill();
    ctx.strokeStyle = '#000a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }


  // range rings on the selected token (movement + weapon ranges). All measured
  // from the *base edge* (per 40k), not the model centre.
  if (input.showRanges && selectedTokenId) {
    const t = state.tokens.find((tk) => tk.id === selectedTokenId);
    if (t) {
      const centre = { x: t.x, y: t.y };
      const move = moveOf(state, t);
      if (move > 0) drawRangeRing(ctx, v, t, centre, move, '#4ea1ff', `M ${move}"`);
      // weapon ranges (gun range) from the unit's ranged weapons
      for (const rg of weaponRangesOf(state, t)) {
        drawRangeRing(ctx, v, t, centre, rg, '#ffb454', `${rg}"`);
      }
    }
  }

  // while dragging a model, show how far it may still move — its Move stat from
  // the pick-up point, measured from the base edge — and turn the reach red once
  // it has over-moved. (The live distance line is drawn by BoardCanvas.)
  if (input.drag) {
    const dt = state.tokens.find((tk) => tk.id === input.drag!.id);
    const move = dt ? moveOf(state, dt) : 0;
    if (dt && move > 0) {
      const moved = Math.hypot(dt.x - input.drag.start.x, dt.y - input.drag.start.y);
      const over = moved > move + 1e-3;
      drawRangeRing(ctx, v, dt, input.drag.start, move, over ? '#ff5d5d' : '#4ea1ff', `M ${move}"`);
    }
  }

  // tokens
  for (const t of state.tokens) {
    drawToken(ctx, v, t, t.id === selectedTokenId);
  }

  // deployment legality + unit coherency aid (my army only)
  if (input.showDeployAid && (mySlot === 'player1' || mySlot === 'player2')) {
    drawDeployAid(ctx, v, state, mySlot);
  }

  // saved ruler (opponent's or persisted)
  if (state.ruler) {
    drawRuler(ctx, v, state.ruler.a, state.ruler.b, ownerColor(state.ruler.owner));
  }
  // live local ruler
  if (liveRuler) {
    drawRuler(ctx, v, liveRuler.a, liveRuler.b, '#ffffff');
  }

  ctx.restore();
}

function unitOf(state: RoomState, t: Token) {
  const roster = state.players[t.owner]?.roster;
  if (!roster || !t.datasheetId) return undefined;
  // move/weapons are datasheet-level, so match by datasheet (model tokens are
  // labelled with the model name, not the unit name)
  return roster.units.find((u) => u.datasheetId === t.datasheetId);
}

function moveOf(state: RoomState, t: Token): number {
  return unitOf(state, t)?.profile?.m ?? 0;
}

// distinct ranged-weapon ranges (inches) for the token's unit, ascending
function weaponRangesOf(state: RoomState, t: Token): number[] {
  const u = unitOf(state, t);
  if (!u?.weapons) return [];
  const set = new Set<number>();
  for (const w of u.weapons) {
    if (w.type !== 'ranged') continue;
    // range may be non-string / empty in some ingested rows — coerce safely
    const m = String(w.range ?? '').match(/(\d+)/);
    if (m) set.add(parseInt(m[1], 10));
  }
  return [...set].sort((a, b) => a - b);
}

// A dashed range outline measured from the model's BASE EDGE (per 40k). The
// outline is the base shape grown outward by `inches`: a bigger circle for round
// bases, a rounded rectangle (exact Minkowski sum) for rect hulls, an expanded
// ellipse for ovals. `centre` is canonical inches (token centre or a drag origin).
function drawRangeRing(
  ctx: CanvasRenderingContext2D,
  v: ViewParams,
  t: Token,
  centre: { x: number; y: number },
  inches: number,
  color: string,
  label: string
) {
  const c = inchesToPx(centre, v);
  const d = inches * v.scale;
  if (!Number.isFinite(d) || d <= 0 || d > 1e5) return; // skip pathological radii
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  const shape = t.baseShape ?? 'circle';
  let topY: number; // screen-y where the label sits (top of the outline)
  if ((shape === 'oval' || shape === 'rect') && t.baseW && t.baseH) {
    const eff = (((t.rotation ?? 0) + (v.flip ? 180 : 0)) * Math.PI) / 180;
    const hw = Math.max(6, (mmToInches(t.baseW) / 2) * v.scale);
    const hh = Math.max(6, (mmToInches(t.baseH) / 2) * v.scale);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(eff);
    ctx.beginPath();
    if (shape === 'oval') ctx.ellipse(0, 0, hw + d, hh + d, 0, 0, Math.PI * 2);
    else roundRectPath(ctx, -hw - d, -hh - d, (hw + d) * 2, (hh + d) * 2, d);
    ctx.stroke();
    ctx.restore();
    topY = c.y - Math.max(hw, hh) - d; // approximate top for the label
  } else {
    const baseR = Math.max(7, (mmToInches(t.baseMm) / 2) * v.scale);
    ctx.beginPath();
    fullArc(ctx, c.x, c.y, baseR + d);
    ctx.stroke();
    topY = c.y - (baseR + d);
  }
  ctx.setLineDash([]);
  ctx.font = '11px system-ui';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.strokeText(label, c.x, topY - 3);
  ctx.fillStyle = color;
  ctx.fillText(label, c.x, topY - 3);
  ctx.textAlign = 'left';
  ctx.restore();
}

// Trace a rounded-rectangle subpath (corner radius r) into the current path.
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawToken(
  ctx: CanvasRenderingContext2D,
  v: ViewParams,
  t: Token,
  selected: boolean
) {
  const c = inchesToPx({ x: t.x, y: t.y }, v);
  const color = ownerColor(t.owner);
  const destroyed = t.status.includes('Destroyed');
  ctx.save();
  if (destroyed) ctx.globalAlpha = 0.35;

  // draw the base in its own shape (circle / oval / rect), rotated. `r` is the
  // text-layout radius (max extent), used for placing labels/pips around it.
  const shape = t.baseShape ?? 'circle';
  const eff = (((t.rotation ?? 0) + (v.flip ? 180 : 0)) * Math.PI) / 180;
  let r: number;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(eff);
  ctx.fillStyle = hexA(color, 0.85);
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.strokeStyle = selected ? '#fff' : '#0009';
  if (shape === 'oval' && t.baseW && t.baseH) {
    const rx = Math.max(6, (mmToInches(t.baseW) / 2) * v.scale);
    const ry = Math.max(6, (mmToInches(t.baseH) / 2) * v.scale);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    r = Math.max(rx, ry);
  } else if (shape === 'rect' && t.baseW && t.baseH) {
    const hw = Math.max(6, (mmToInches(t.baseW) / 2) * v.scale);
    const hh = Math.max(6, (mmToInches(t.baseH) / 2) * v.scale);
    ctx.beginPath();
    ctx.rect(-hw, -hh, hw * 2, hh * 2);
    ctx.fill();
    ctx.stroke();
    r = Math.max(hw, hh);
  } else {
    r = Math.max(7, (mmToInches(t.baseMm) / 2) * v.scale);
    ctx.beginPath();
    fullArc(ctx, 0, 0, r);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // label
  ctx.fillStyle = '#0a0a0a';
  ctx.font = `bold ${Math.max(9, Math.min(13, r * 0.7))}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const short = t.label.length > 10 ? t.label.slice(0, 9) + '…' : t.label;
  ctx.fillText(short, c.x, c.y);

  // wounds pip
  ctx.font = `${Math.max(8, r * 0.5)}px system-ui`;
  ctx.textBaseline = 'top';
  const woundTxt = `${t.woundsCurrent}/${t.woundsMax}w`;
  const modelTxt = t.modelsMax > 1 ? `  ${t.modelsCurrent}/${t.modelsMax}m` : '';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  const below = woundTxt + modelTxt;
  ctx.strokeText(below, c.x, c.y + r + 2);
  ctx.fillText(below, c.x, c.y + r + 2);

  // status chips
  if (t.status.length) {
    const chip = t.status.join(', ');
    ctx.fillStyle = destroyed ? '#ff6b6b' : '#f2c14e';
    ctx.strokeText(chip, c.x, c.y + r + 2 + 11);
    ctx.fillText(chip, c.x, c.y + r + 2 + 11);
  }
  // below-half-strength marker (drives battle-shock tests & some scoring)
  const belowHalf =
    t.modelsMax > 1 ? t.modelsCurrent * 2 < t.modelsMax : t.woundsCurrent * 2 < t.woundsMax;
  if (belowHalf && !destroyed) {
    ctx.fillStyle = '#ff8ad1';
    const yy = c.y + r + 2 + (t.status.length ? 22 : 11);
    ctx.strokeText('below ½', c.x, yy);
    ctx.fillText('below ½', c.x, yy);
  }
  // special weapon marker (above the token)
  if (t.weapon) {
    ctx.fillStyle = '#ffd84e';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    const w = `★ ${t.weapon.length > 14 ? t.weapon.slice(0, 13) + '…' : t.weapon}`;
    ctx.strokeText(w, c.x, c.y - r - 4);
    ctx.fillText(w, c.x, c.y - r - 4);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawRuler(
  ctx: CanvasRenderingContext2D,
  v: ViewParams,
  a: { x: number; y: number },
  b: { x: number; y: number },
  color: string
) {
  const pa = inchesToPx(a, v);
  const pb = inchesToPx(b, v);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  const d = Math.hypot(a.x - b.x, a.y - b.y);
  const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
  const label = `${d.toFixed(1)}"`;
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(label, mid.x, mid.y - 8);
  ctx.fillText(label, mid.x, mid.y - 8);
  ctx.textAlign = 'left';
  for (const p of [pa, pb]) {
    ctx.beginPath();
    fullArc(ctx, p.x, p.y, 3);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function hatch(ctx: CanvasRenderingContext2D, t: any, v: ViewParams) {
  // light diagonal hatch over the bounding box for obscuring hint
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const pts: { x: number; y: number }[] = [];
  if (t.shape === 'rect') {
    const [x, y, w, h] = t.geom;
    pts.push({ x, y }, { x: x + w, y: y + h });
  } else if (t.shape === 'triangle') {
    pts.push({ x: t.geom[0], y: t.geom[1] }, { x: t.geom[2], y: t.geom[3] }, { x: t.geom[4], y: t.geom[5] });
  } else {
    const [cx, cy, r] = t.geom;
    pts.push({ x: cx - r, y: cy - r }, { x: cx + r, y: cy + r });
  }
  for (const p of pts) {
    const px = inchesToPx(p, v);
    minX = Math.min(minX, px.x); minY = Math.min(minY, px.y);
    maxX = Math.max(maxX, px.x); maxY = Math.max(maxY, px.y);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(minX, minY, maxX - minX, maxY - minY);
  ctx.clip();
  ctx.strokeStyle = 'rgba(200,210,220,0.25)';
  ctx.lineWidth = 1;
  for (let x = minX - (maxY - minY); x < maxX; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, minY);
    ctx.lineTo(x + (maxY - minY), maxY);
    ctx.stroke();
  }
  ctx.restore();
}

function line(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}
// --- deployment legality + coherency aid ---

// Base radius in inches (max half-extent for non-circular bases) — used for
// edge-to-edge distances (9" deploy gap, 2" coherency).
function baseRin(t: Token): number {
  if ((t.baseShape === 'oval' || t.baseShape === 'rect') && t.baseW && t.baseH) {
    return mmToInches(Math.max(t.baseW, t.baseH)) / 2;
  }
  return mmToInches(t.baseMm) / 2;
}

function pointInPolygon(x: number, y: number, poly: number[]): boolean {
  let inside = false;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2], yi = poly[i * 2 + 1];
    const xj = poly[j * 2], yj = poly[j * 2 + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function markRing(
  ctx: CanvasRenderingContext2D,
  v: ViewParams,
  t: Token,
  color: string,
  label: string,
  pad: number,
  below: boolean
) {
  const c = inchesToPx({ x: t.x, y: t.y }, v);
  const r = Math.max(8, baseRin(t) * v.scale) + pad;
  ctx.save();
  ctx.beginPath();
  fullArc(ctx, c.x, c.y, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  const ly = below ? c.y + r + 11 : c.y - r - 3;
  ctx.strokeText(label, c.x, ly);
  ctx.fillStyle = color;
  ctx.fillText(label, c.x, ly);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawDeployAid(
  ctx: CanvasRenderingContext2D,
  v: ViewParams,
  state: RoomState,
  mySlot: PlayerSlot
) {
  const ownZone = state.layout.deploymentZones.find((z) => z.player === mySlot)?.polygon;
  const enemy: PlayerSlot = mySlot === 'player1' ? 'player2' : 'player1';
  const alive = (t: Token) => !t.status.includes('Destroyed');
  const mine = state.tokens.filter((t) => t.owner === mySlot && alive(t));
  const foes = state.tokens.filter((t) => t.owner === enemy && alive(t));

  // deployment legality: must sit inside own zone and >9" from every enemy model
  for (const t of mine) {
    const inZone = ownZone ? pointInPolygon(t.x, t.y, ownZone) : true;
    const rT = baseRin(t);
    if (!inZone) {
      markRing(ctx, v, t, '#ff5d5d', 'out of zone', 4, false);
      continue;
    }
    const near = foes.some((e) => Math.hypot(t.x - e.x, t.y - e.y) - rT - baseRin(e) <= 9);
    if (near) markRing(ctx, v, t, '#ff5d5d', '<9" enemy', 4, false);
  }

  // coherency: every model within 2" (base-to-base) of another in its unit; units
  // of 7+ need two such neighbours.
  const groups = new Map<string, Token[]>();
  for (const t of mine) {
    if (!t.groupId) continue;
    const g = groups.get(t.groupId);
    if (g) g.push(t);
    else groups.set(t.groupId, [t]);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const need = g.length >= 7 ? 2 : 1;
    for (const t of g) {
      const rT = baseRin(t);
      const neighbours = g.filter(
        (o) => o !== t && Math.hypot(t.x - o.x, t.y - o.y) - rT - baseRin(o) <= 2
      ).length;
      if (neighbours < need) markRing(ctx, v, t, '#ffa94d', 'coherency', 9, true);
    }
  }
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
