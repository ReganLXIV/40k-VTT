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

export interface RenderInput {
  ctx: CanvasRenderingContext2D;
  v: ViewParams;
  state: RoomState;
  mySlot: PlayerSlot | 'spectator' | null;
  selectedTokenId: string | null;
  showGrid: boolean;
  liveRuler: { a: { x: number; y: number }; b: { x: number; y: number } } | null;
  showRanges?: boolean;
  rangeRingInch?: number;
  showNoDeploy?: boolean;
  noDeployRadius?: number;
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

  // deployment zones
  for (const dz of layout.deploymentZones) {
    const mine = dz.player === mySlot;
    ctx.beginPath();
    for (let i = 0; i < dz.polygon.length; i += 2) {
      const p = inchesToPx({ x: dz.polygon[i], y: dz.polygon[i + 1] }, v);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    const c = ownerColor(dz.player);
    ctx.fillStyle = hexA(c, mine ? 0.16 : 0.08);
    ctx.fill();
    ctx.strokeStyle = hexA(c, 0.5);
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = mine ? 2 : 1;
    ctx.stroke();
    ctx.setLineDash([]);
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

  // no-deployment radius around the central objective(s) — you can't set up units
  // within this circle during deployment.
  if (input.showNoDeploy && (input.noDeployRadius ?? 0) > 0) {
    const centres = layout.objectives.filter((o) => o.type === 'central');
    const spots = centres.length
      ? centres.map((o) => ({ x: o.cx, y: o.cy }))
      : [{ x: layout.width / 2, y: layout.height / 2 }];
    for (const s of spots) {
      const c = inchesToPx(s, v);
      const rad = (input.noDeployRadius ?? 9) * v.scale;
      ctx.save();
      ctx.beginPath();
      fullArc(ctx, c.x, c.y, rad);
      ctx.fillStyle = 'rgba(229,57,53,0.10)';
      ctx.fill();
      ctx.setLineDash([8, 5]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#e53935';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e53935';
      ctx.font = `bold ${Math.max(10, v.scale * 0.8)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('NO DEPLOY', c.x, c.y - rad - 4);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  // range rings on the selected token (movement + custom range)
  if (input.showRanges && selectedTokenId) {
    const t = state.tokens.find((tk) => tk.id === selectedTokenId);
    if (t) {
      const c = inchesToPx({ x: t.x, y: t.y }, v);
      const move = moveOf(state, t);
      if (move > 0) drawRangeRing(ctx, c, move, v.scale, '#4ea1ff', `M ${move}"`);
      // weapon ranges (gun range) from the unit's ranged weapons
      for (const rg of weaponRangesOf(state, t)) {
        drawRangeRing(ctx, c, rg, v.scale, '#ffb454', `${rg}"`);
      }
    }
  }

  // tokens
  for (const t of state.tokens) {
    drawToken(ctx, v, t, t.id === selectedTokenId);
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

function drawRangeRing(
  ctx: CanvasRenderingContext2D,
  c: { x: number; y: number },
  inches: number,
  scale: number,
  color: string,
  label: string
) {
  const rad = inches * scale;
  if (!Number.isFinite(rad) || rad <= 0 || rad > 1e5) return; // skip pathological radii
  ctx.beginPath();
  fullArc(ctx, c.x, c.y, rad);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(label, c.x, c.y - rad - 3);
  ctx.fillText(label, c.x, c.y - rad - 3);
  ctx.textAlign = 'left';
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
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
