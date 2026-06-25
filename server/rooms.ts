import { customAlphabet } from 'nanoid';
import type {
  HydratedRoster,
  HydratedUnit,
  Layout,
  PlayerSlot,
  RoomState,
  Token,
} from '../shared/types.js';
import { getDefaultLayout, getLayoutById } from './layouts.js';
import { baseTouchesTerrain, objectiveFootprint } from '../shared/objectives.js';

// Ambiguity-free alphabet (no 0/O/1/I/L).
const makeCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 5);

const ROOM_TTL_MS = 30 * 60 * 1000; // empty room reaped after 30 min

interface RoomEntry {
  state: RoomState;
  emptySince: number | null;
}

const rooms = new Map<string, RoomEntry>();

function freshState(code: string, layout: Layout): RoomState {
  const objectives: Record<string, PlayerSlot | null> = {};
  for (const o of layout.objectives) objectives[o.id] = o.controlledBy;
  return {
    code,
    layout,
    players: {},
    tokens: [],
    objectives,
    dice: [],
    ruler: null,
    turn: 1,
    activePlayer: 'player1',
    phase: 'Command',
    notes: { player1: '', player2: '' },
    commandPoints: { player1: 0, player2: 0 },
    score: { player1: 0, player2: 0 },
  };
}

export function createRoom(layoutId?: string): RoomState {
  let code = makeCode();
  while (rooms.has(code)) code = makeCode();
  const layout = layoutId ? getLayoutById(layoutId) ?? getDefaultLayout() : getDefaultLayout();
  const state = freshState(code, layout);
  rooms.set(code, { state, emptySince: null });
  return state;
}

export function getRoom(code: string): RoomState | null {
  return rooms.get(code)?.state ?? null;
}

export function markEmptyIfNeeded(code: string) {
  const entry = rooms.get(code);
  if (!entry) return;
  const anyConnected =
    entry.state.players.player1?.connected ||
    entry.state.players.player2?.connected;
  entry.emptySince = anyConnected ? null : Date.now();
}

export function reapEmptyRooms() {
  const now = Date.now();
  for (const [code, entry] of rooms) {
    if (entry.emptySince !== null && now - entry.emptySince > ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}

export function setRosterTokensCleared(state: RoomState, slot: PlayerSlot) {
  state.tokens = state.tokens.filter((t) => t.owner !== slot);
}

export function setLayout(state: RoomState, layout: Layout) {
  state.layout = layout;
  const objectives: Record<string, PlayerSlot | null> = {};
  for (const o of layout.objectives) objectives[o.id] = state.objectives[o.id] ?? o.controlledBy;
  state.objectives = objectives;
}

function unitWoundsMax(u: HydratedUnit): number {
  if (u.modelLines && u.modelLines.length) {
    return u.modelLines.reduce((sum, m) => sum + m.count * m.woundsEach, 0);
  }
  const perModel = u.profile?.w ?? 1;
  return perModel * (u.modelCount || 1);
}

export function spawnTokensFromUnit(
  state: RoomState,
  owner: PlayerSlot,
  unitId: string,
  asModels: boolean,
  makeId: () => string
): Token[] {
  const roster = state.players[owner]?.roster;
  if (!roster) return [];
  const unit = roster.units.find((u) => u.id === unitId);
  if (!unit) return [];

  const startX = owner === 'player1' ? state.layout.width * 0.25 : state.layout.width * 0.75;
  const startY = owner === 'player1' ? state.layout.height * 0.85 : state.layout.height * 0.15;

  // Expand the unit into per-model entries (name + base + wounds). Prefer the
  // hydrated modelLines (per-model bases like Ghazghkull 80mm / Makari 25mm);
  // fall back to a uniform breakdown for unmatched units.
  const lines =
    unit.modelLines && unit.modelLines.length
      ? unit.modelLines
      : [
          {
            count: unit.modelCount || 1,
            name: unit.rawName,
            baseMm: unit.baseMm,
            woundsEach: unit.profile?.w ?? 1,
            baseShape: unit.baseShape,
            baseW: unit.baseW,
            baseH: unit.baseH,
          },
        ];
  type Flat = {
    name: string;
    baseMm: number;
    woundsEach: number;
    baseShape?: 'circle' | 'oval' | 'rect';
    baseW?: number;
    baseH?: number;
  };
  const flat: Flat[] = [];
  for (const l of lines)
    for (let i = 0; i < l.count; i++)
      flat.push({ name: l.name, baseMm: l.baseMm, woundsEach: l.woundsEach, baseShape: l.baseShape, baseW: l.baseW, baseH: l.baseH });

  const created: Token[] = [];
  if (asModels && flat.length > 1) {
    const cols = Math.ceil(Math.sqrt(flat.length));
    const spacing = Math.max(unit.baseMm / 25.4, 1.0) + 0.2;
    const labelCounts: Record<string, number> = {};
    flat.forEach((m, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      labelCounts[m.name] = (labelCounts[m.name] ?? 0) + 1;
      const sameName = lines.find((l) => l.name === m.name)?.count ?? 1;
      const label = sameName > 1 ? `${m.name} ${labelCounts[m.name]}` : m.name;
      created.push({
        id: makeId(),
        owner,
        datasheetId: unit.datasheetId,
        label,
        x: startX + col * spacing,
        y: startY + row * spacing * (owner === 'player1' ? -1 : 1),
        baseMm: m.baseMm,
        baseShape: m.baseShape,
        baseW: m.baseW,
        baseH: m.baseH,
        rotation: 0,
        woundsMax: m.woundsEach,
        woundsCurrent: m.woundsEach,
        modelsMax: 1,
        modelsCurrent: 1,
        status: [],
      });
    });
  } else {
    created.push({
      id: makeId(),
      owner,
      datasheetId: unit.datasheetId,
      label: unit.rawName,
      x: startX,
      y: startY,
      baseMm: unit.baseMm,
      baseShape: unit.baseShape,
      baseW: unit.baseW,
      baseH: unit.baseH,
      rotation: 0,
      woundsMax: unitWoundsMax(unit),
      woundsCurrent: unitWoundsMax(unit),
      modelsMax: unit.modelCount || 1,
      modelsCurrent: unit.modelCount || 1,
      status: [],
    });
  }
  state.tokens.push(...created);
  return created;
}

// Deploy every roster unit not yet on the table, as individual MODEL tokens,
// laid out unit-by-unit (each unit clustered) across the owner's deployment zone.
export function deployAll(state: RoomState, owner: PlayerSlot, makeId: () => string) {
  const roster = state.players[owner]?.roster;
  if (!roster) return;
  const placed = state.tokens.filter((t) => t.owner === owner);
  const present = new Set(placed.map((t) => t.label.replace(/\s+\d+$/, '')));
  const pending = roster.units.filter((u) => !present.has(u.rawName));
  if (!pending.length) return;

  const zone = state.layout.deploymentZones.find((z) => z.player === owner);
  let minX = state.layout.width, minY = state.layout.height, maxX = 0, maxY = 0;
  const poly = zone?.polygon ?? [0, 0, state.layout.width, 0, state.layout.width, state.layout.height, 0, state.layout.height];
  for (let i = 0; i < poly.length; i += 2) {
    minX = Math.min(minX, poly[i]); maxX = Math.max(maxX, poly[i]);
    minY = Math.min(minY, poly[i + 1]); maxY = Math.max(maxY, poly[i + 1]);
  }
  const pad = 1.5;
  minX += pad; minY += pad; maxX -= pad; maxY -= pad;

  // grid one cell per unit; each cell holds that unit's models in a small block
  const unitCols = Math.ceil(Math.sqrt(pending.length));
  const unitRows = Math.ceil(pending.length / unitCols);
  const cellW = (maxX - minX) / unitCols;
  const cellH = (maxY - minY) / unitRows;

  pending.forEach((u, ui) => {
    const cellX = minX + (ui % unitCols) * cellW;
    const cellY = minY + Math.floor(ui / unitCols) * cellH;

    const lines = u.modelLines && u.modelLines.length
      ? u.modelLines
      : [{ count: u.modelCount || 1, name: u.rawName, baseMm: u.baseMm, woundsEach: u.profile?.w ?? 1, baseShape: u.baseShape, baseW: u.baseW, baseH: u.baseH }];
    const flat: { name: string; baseMm: number; woundsEach: number; baseShape?: 'circle' | 'oval' | 'rect'; baseW?: number; baseH?: number }[] = [];
    for (const l of lines) for (let i = 0; i < l.count; i++) flat.push({ name: l.name, baseMm: l.baseMm, woundsEach: l.woundsEach, baseShape: l.baseShape, baseW: l.baseW, baseH: l.baseH });

    const cols = Math.max(1, Math.ceil(Math.sqrt(flat.length)));
    const spacing = Math.max(u.baseMm / 25.4, 0.9) + 0.15;
    const labelCounts: Record<string, number> = {};
    flat.forEach((m, i) => {
      labelCounts[m.name] = (labelCounts[m.name] ?? 0) + 1;
      const total = lines.find((l) => l.name === m.name)?.count ?? 1;
      state.tokens.push({
        id: makeId(),
        owner,
        datasheetId: u.datasheetId,
        label: total > 1 ? `${m.name} ${labelCounts[m.name]}` : m.name,
        x: Math.min(maxX, cellX + (i % cols) * spacing + 0.5),
        y: Math.min(maxY, cellY + Math.floor(i / cols) * spacing + 0.5),
        baseMm: m.baseMm,
        baseShape: m.baseShape,
        baseW: m.baseW,
        baseH: m.baseH,
        rotation: 0,
        woundsMax: m.woundsEach,
        woundsCurrent: m.woundsEach,
        modelsMax: 1,
        modelsCurrent: 1,
        status: [],
      });
    });
  });
}

// Objective Control of a single token: the unit's per-model OC, 0 if battle-shocked.
function tokenOC(state: RoomState, t: Token): number {
  if (t.status.includes('Battle-shocked')) return 0;
  const roster = state.players[t.owner]?.roster;
  const unit = roster?.units.find((u) => u.datasheetId === t.datasheetId);
  const oc = unit?.profile?.oc;
  return typeof oc === 'number' ? oc : Number(oc) || 0;
}

// Recompute who controls each objective from model OC. The objective is the whole
// terrain footprint it sits on: a model counts if its BASE TOUCHES that footprint
// (it doesn't have to be wholly inside). If an objective isn't on a footprint we
// fall back to its marker range. Battle-shocked/destroyed models contribute
// nothing. Ties (incl. 0–0) keep the current controller.
export function computeObjectiveControl(
  state: RoomState
): Record<string, PlayerSlot | null> {
  const result: Record<string, PlayerSlot | null> = { ...state.objectives };
  for (const o of state.layout.objectives) {
    const foot = objectiveFootprint(o, state.layout);
    let p1 = 0;
    let p2 = 0;
    for (const t of state.tokens) {
      if (t.status.includes('Destroyed')) continue;
      const oc = tokenOC(state, t);
      if (oc <= 0) continue;
      const baseR = t.baseMm / 25.4 / 2;
      const touches = foot
        ? baseTouchesTerrain(t.x, t.y, baseR, foot)
        : Math.hypot(o.cx - t.x, o.cy - t.y) <= o.radiusInch + baseR;
      if (!touches) continue;
      if (t.owner === 'player1') p1 += oc;
      else p2 += oc;
    }
    if (p1 > p2) result[o.id] = 'player1';
    else if (p2 > p1) result[o.id] = 'player2';
    // tie → leave control unchanged
  }
  return result;
}

export { type HydratedRoster };
