// Types shared between client and server.

// ---------- Datasheet / stat DB ----------

export type BaseShape = 'circle' | 'oval' | 'rect';

export interface ModelProfile {
  modelName: string;
  m: number; // movement (inches)
  t: number; // toughness
  sv: string; // save e.g. "3+"
  invSv: string; // invulnerable save e.g. "4+" or "" if none
  w: number; // wounds
  ld: string; // leadership e.g. "6+"
  oc: number; // objective control
  baseMm?: number; // base diameter (circle) or longest dimension (mm)
  baseShape?: BaseShape;
  baseW?: number; // mm (width across) — for oval / rect (hull)
  baseH?: number; // mm (length) — for oval / rect (hull)
}

export interface Weapon {
  name: string;
  type: 'ranged' | 'melee';
  range: string; // "Melee" or e.g. '24"'
  a: string; // attacks
  skill: string; // BS or WS e.g. "3+"
  s: string; // strength
  ap: string; // armour penetration e.g. "-1"
  d: string; // damage
  keywords: string; // e.g. "Assault, Lethal Hits"
}

export interface Ability {
  name: string;
  description: string;
  type?: string; // 'Core' | 'Faction' | 'Datasheet' | 'Wargear' | ... (from Wahapedia)
  parameter?: string; // e.g. Scouts -> '9"', Feel No Pain -> '5+'
}

export interface Datasheet {
  id: string;
  name: string;
  factionId: string;
  factionName: string;
  role: string;
  baseMm: number;
  baseShape: BaseShape;
  baseW: number; // mm
  baseH: number; // mm
  background: string;
  profiles: ModelProfile[];
  weapons: Weapon[];
  abilities: Ability[];
  keywords: string[];
  leads: string[]; // bodyguard unit names this datasheet can lead (Leader ability)
}

// ---------- Detachment / stratagems ----------

export interface Stratagem {
  name: string;
  type: string; // e.g. "Battle Tactic Stratagem"
  cpCost: string;
  turn: string;
  phase: string;
  description: string;
}

export interface Enhancement {
  name: string;
  cost: string;
  description: string;
}

export interface DetachmentInfo {
  faction: string;
  detachment: string;
  abilities: { name: string; description: string }[];
  enhancements: Enhancement[];
  stratagems: Stratagem[];
}

// ---------- Army import ----------

export interface RawUnit {
  rawName: string;
  points: number;
  models: { count: number; name: string }[];
  wargear: string[];
  enhancements: string[];
  section?: string;
  warlord?: boolean;
  declaredModels?: number; // unit-level "Nx" count when models aren't enumerated as bullets
}

export interface RawRoster {
  armyName?: string;
  faction?: string; // e.g. "Necrons"
  detachment?: string;
  declaredPoints?: number;
  units: RawUnit[];
}

export interface HydratedUnit {
  id: string; // generated id for this game instance
  rawName: string;
  datasheetId: string | null;
  matchConfidence: number; // 1 = exact
  points: number;
  modelCount: number;
  profile?: ModelProfile;
  altProfiles?: ModelProfile[];
  weapons?: Weapon[];
  abilities?: Ability[];
  keywords?: string[];
  leads?: string[];
  baseMm: number;
  baseShape?: BaseShape;
  baseW?: number; // mm
  baseH?: number; // mm
  // per-model breakdown (e.g. Ghazghkull 80mm + Makari 25mm), resolved against the
  // datasheet's model profiles; used so "deploy as models" gives correct bases/wounds.
  modelLines?: {
    count: number;
    name: string;
    baseMm: number;
    woundsEach: number;
    baseShape?: BaseShape;
    baseW?: number;
    baseH?: number;
  }[];
  wargear: string[];
  enhancements: string[];
}

export interface HydratedRoster {
  armyName?: string;
  faction?: string;
  detachment?: string;
  declaredPoints?: number;
  units: HydratedUnit[];
  unmatchedCount: number;
}

// ---------- Layouts ----------

export type BoardSize = 'strike_force' | 'incursion' | 'combat_patrol';

export interface TerrainArea {
  id: string;
  shape: 'rect' | 'triangle' | 'circle';
  // rect: [x,y,w,h] ; triangle: [x0,y0,x1,y1,x2,y2] ; circle: [cx,cy,r] — all inches
  geom: number[];
  rotationDeg?: number;
  label?: string;
  obscuring?: boolean;
}

export interface Objective {
  id: string;
  cx: number;
  cy: number;
  type: 'home' | 'expansion' | 'central';
  radiusInch: number;
  controlledBy: null | 'player1' | 'player2';
}

export interface DeploymentZone {
  player: 'player1' | 'player2';
  polygon: number[]; // flat [x0,y0,x1,y1,...] inches
}

// Line-of-sight detail inside ruins (walls / foliage) — flat polygon [x0,y0,x1,y1,...] inches.
export interface TerrainDetail {
  kind: 'wall' | 'foliage';
  geom: number[];
}

export interface Layout {
  id: string;
  name: string;
  boardSize: BoardSize;
  width: number; // inches
  height: number; // inches
  terrain: TerrainArea[];
  details?: TerrainDetail[];
  objectives: Objective[];
  deploymentZones: DeploymentZone[];
}

// ---------- Room / real-time ----------

export type PlayerSlot = 'player1' | 'player2';

export interface Token {
  id: string;
  owner: PlayerSlot;
  datasheetId: string | null;
  label: string;
  x: number; // canonical inches (centre)
  y: number;
  baseMm: number;
  woundsMax: number;
  woundsCurrent: number;
  modelsMax: number;
  modelsCurrent: number;
  status: string[];
  weapon?: string; // designated special/heavy weapon held by this model
  baseShape?: BaseShape; // defaults to circle (baseMm)
  baseW?: number; // mm — oval / rect width
  baseH?: number; // mm — oval / rect length
  rotation?: number; // degrees (for non-circular bases)
}

export interface DiceResult {
  id: string;
  owner: PlayerSlot;
  label?: string;
  n: number;
  sides: number;
  rolls: number[];
  total: number;
  at: number; // epoch ms
}

export interface Point {
  x: number;
  y: number;
}

export interface Ruler {
  a: Point;
  b: Point;
  owner: PlayerSlot;
}

export interface PlayerState {
  connected: boolean;
  roster?: HydratedRoster;
}

export interface RoomState {
  code: string;
  layout: Layout;
  players: {
    player1?: PlayerState;
    player2?: PlayerState;
  };
  tokens: Token[];
  objectives: Record<string, PlayerSlot | null>;
  dice: DiceResult[];
  ruler?: Ruler | null;
  turn: number; // battle round (1-5)
  activePlayer: PlayerSlot;
  phase: GamePhase;
  notes: Record<PlayerSlot, string>; // private scratchpad per player
  commandPoints: Record<PlayerSlot, number>;
  score: Record<PlayerSlot, number>;
}

export type GamePhase = 'Command' | 'Movement' | 'Shooting' | 'Charge' | 'Fight';
export const GAME_PHASES: GamePhase[] = [
  'Command',
  'Movement',
  'Shooting',
  'Charge',
  'Fight',
];

// ---------- Socket event payloads ----------

export interface RoomJoinedPayload {
  code: string;
  slot: PlayerSlot | 'spectator';
  state: RoomState;
}

export interface ClientToServer {
  'room:create': (
    data: { layoutId?: string },
    ack: (res: RoomJoinedPayload | { error: string }) => void
  ) => void;
  'room:join': (
    data: { code: string; asSpectator?: boolean },
    ack: (res: RoomJoinedPayload | { error: string }) => void
  ) => void;
  'room:leave': () => void;
  'army:set': (data: { roster: HydratedRoster }) => void;
  'layout:set': (data: { layout: Layout }) => void;
  'token:spawn': (data: { fromUnitId: string; asModels?: boolean }) => void;
  'token:move': (data: { id: string; x: number; y: number }) => void;
  'token:update': (data: { id: string; partial: Partial<Token> }) => void;
  'token:remove': (data: { id: string }) => void;
  'token:clone': (data: { id: string; count?: number }) => void;
  'objective:set': (data: { id: string; controlledBy: PlayerSlot | null }) => void;
  'dice:roll': (data: { n: number; sides: number; label?: string }) => void;
  'dice:reroll1s': (data: { id: string }) => void;
  'ruler:set': (data: { a: Point; b: Point }) => void;
  'ruler:clear': () => void;
  'turn:next': () => void;
  'notes:set': (data: { text: string }) => void;
  'phase:next': () => void;
  'phase:set': (data: { phase: GamePhase }) => void;
  'cp:adjust': (data: { player: PlayerSlot; delta: number }) => void;
  'score:adjust': (data: { player: PlayerSlot; delta: number }) => void;
  'objectives:auto': () => void; // recompute objective control from model OC
  'score:primary': () => void; // auto-control, then score primary VP for the active player
  'game:rollOff': () => void; // roll off for who takes the first turn
  'ping:add': (data: { x: number; y: number }) => void;
  'army:deployAll': () => void;
  'tokens:clearMine': () => void;
}

export interface PingEvent {
  x: number;
  y: number;
  owner: PlayerSlot;
  at: number;
}

export interface ServerToClient {
  'state:full': (state: RoomState) => void;
  'state:patch': (state: RoomState) => void; // we resend full state; simplest for 2 players
  'room:error': (data: { error: string }) => void;
  'ping:show': (data: PingEvent) => void;
}
