import { create } from 'zustand';
import type {
  GamePhase,
  HydratedRoster,
  Layout,
  PingEvent,
  PlayerSlot,
  RoomState,
} from '@shared/types';
import { socket } from '../socket';
import { SECONDARY_CARDS } from '../data/missions';

const SECONDARY_CARD_IDS = SECONDARY_CARDS.map((c) => c.id);

export type Tool = 'select' | 'ruler' | 'ping' | 'pan';

// transient ping markers (not in room state); pruned by the board render loop
export const livePings: PingEvent[] = [];

interface GameStore {
  connected: boolean;
  code: string | null;
  slot: PlayerSlot | 'spectator' | null;
  state: RoomState | null;

  // local-only board state
  myRoster: HydratedRoster | null; // roster being prepared in lobby before room
  selectedTokenId: string | null;
  selectedIds: string[]; // marquee multi-selection (mirrored from the board)
  tool: Tool;
  showGrid: boolean;
  showRanges: boolean;
  rangeRingInch: number; // custom range ring (e.g. charge 12")
  renderError: string | null; // last caught board-render error (for on-screen diagnostics)

  // private Tactical secondary deck (local to this browser, persisted)
  secDeck: string[];
  secHand: string[];
  secDiscard: string[];

  setMyRoster: (r: HydratedRoster | null) => void;
  setSelectedToken: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  setTool: (t: Tool) => void;
  toggleGrid: () => void;
  toggleRanges: () => void;
  setRangeRing: (n: number) => void;

  secShuffle: () => void; // (re)build a fresh shuffled deck
  secDraw: () => void; // draw the top card into the hand
  secDiscardCard: (id: string) => void; // hand -> discard (scored or discarded)

  flip: boolean; // does this client render flipped (player2)?
}

// --- Tactical secondary deck persistence (private, per-browser) ---
const SEC_KEY = 'vtt-secondaries';
type SecState = { secDeck: string[]; secHand: string[]; secDiscard: string[] };
function loadSec(): SecState {
  try {
    const s = JSON.parse(localStorage.getItem(SEC_KEY) || 'null');
    if (s && Array.isArray(s.secDeck)) return s;
  } catch {
    /* ignore */
  }
  return { secDeck: [], secHand: [], secDiscard: [] };
}
function saveSec(s: SecState) {
  try {
    localStorage.setItem(SEC_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const useGame = create<GameStore>((set, get) => {
  socket.on('connect', () => set({ connected: true }));
  socket.on('disconnect', () => set({ connected: false }));

  const pruneSelections = (state: RoomState) => {
    // drop selections for tokens that vanished
    const ids = new Set(state.tokens.map((t) => t.id));
    const sel = get().selectedTokenId;
    if (sel && !ids.has(sel)) set({ selectedTokenId: null });
    const multi = get().selectedIds;
    if (multi.some((id) => !ids.has(id))) set({ selectedIds: multi.filter((id) => ids.has(id)) });
  };
  // Full state (incl. layout geometry) — on join/create ack and layout changes.
  const onFull = (state: RoomState) => {
    set({ state });
    pruneSelections(state);
  };
  // Patch (routine updates) — layout geometry is stripped to save bandwidth, so
  // reuse the cached full layout (same id) rather than the empty stub.
  const onPatch = (incoming: RoomState) => {
    const prev = get().state;
    const layout =
      prev?.layout && prev.layout.id === incoming.layout.id ? prev.layout : incoming.layout;
    const state = { ...incoming, layout };
    set({ state });
    pruneSelections(state);
  };
  socket.on('state:full', onFull);
  socket.on('state:patch', onPatch);
  socket.on('ping:show', (p) => {
    livePings.push(p);
    if (livePings.length > 12) livePings.shift();
  });

  return {
    connected: socket.connected,
    code: null,
    slot: null,
    state: null,
    myRoster: null,
    selectedTokenId: null,
    selectedIds: [],
    tool: 'select',
    showGrid: true,
    showRanges: false,
    rangeRingInch: 12,
    renderError: null,
    ...loadSec(),
    flip: false,

    setMyRoster: (r) => set({ myRoster: r }),
    setSelectedToken: (id) => set({ selectedTokenId: id }),
    setSelectedIds: (ids) => set({ selectedIds: ids }),
    setTool: (t) => set({ tool: t }),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    toggleRanges: () => set((s) => ({ showRanges: !s.showRanges })),
    setRangeRing: (n) => set({ rangeRingInch: Math.max(1, Math.min(60, n)) }),

    secShuffle: () =>
      set(() => {
        const next = { secDeck: shuffled(SECONDARY_CARD_IDS), secHand: [], secDiscard: [] };
        saveSec(next);
        return next;
      }),
    secDraw: () =>
      set((s) => {
        let deck = s.secDeck;
        let discard = s.secDiscard;
        if (deck.length === 0 && discard.length > 0) {
          deck = shuffled(discard); // reshuffle the discard pile when the deck runs out
          discard = [];
        }
        if (deck.length === 0) return s;
        const [top, ...rest] = deck;
        const next = { secDeck: rest, secHand: [...s.secHand, top], secDiscard: discard };
        saveSec(next);
        return next;
      }),
    secDiscardCard: (id) =>
      set((s) => {
        if (!s.secHand.includes(id)) return s;
        const next = {
          secDeck: s.secDeck,
          secHand: s.secHand.filter((c) => c !== id),
          secDiscard: [...s.secDiscard, id],
        };
        saveSec(next);
        return next;
      }),
  };
});

export function setRoomJoin(
  code: string,
  slot: PlayerSlot | 'spectator',
  state: RoomState
) {
  useGame.setState({
    code,
    slot,
    state,
    flip: slot === 'player2',
  });
}

export function leaveRoom() {
  socket.emit('room:leave');
  useGame.setState({ code: null, slot: null, state: null, selectedTokenId: null });
}

// thin emit helpers
export const intents = {
  setArmy: (roster: HydratedRoster) => socket.emit('army:set', { roster }),
  setLayout: (layout: Layout) => socket.emit('layout:set', { layout }),
  spawn: (fromUnitId: string, asModels?: boolean) =>
    socket.emit('token:spawn', { fromUnitId, asModels }),
  move: (id: string, x: number, y: number) => socket.emit('token:move', { id, x, y }),
  update: (id: string, partial: Record<string, unknown>) =>
    socket.emit('token:update', { id, partial: partial as any }),
  remove: (id: string) => socket.emit('token:remove', { id }),
  clone: (id: string, count = 1) => socket.emit('token:clone', { id, count }),
  objective: (id: string, controlledBy: PlayerSlot | null) =>
    socket.emit('objective:set', { id, controlledBy }),
  roll: (n: number, sides: number, label?: string) =>
    socket.emit('dice:roll', { n, sides, label }),
  reroll1s: (id: string) => socket.emit('dice:reroll1s', { id }),
  ruler: (a: { x: number; y: number }, b: { x: number; y: number }) =>
    socket.emit('ruler:set', { a, b }),
  rulerClear: () => socket.emit('ruler:clear'),
  nextTurn: () => socket.emit('turn:next'),
  setNotes: (text: string) => socket.emit('notes:set', { text }),
  nextPhase: () => socket.emit('phase:next'),
  setPhase: (phase: GamePhase) => socket.emit('phase:set', { phase }),
  adjustCp: (player: PlayerSlot, delta: number) => socket.emit('cp:adjust', { player, delta }),
  adjustScore: (player: PlayerSlot, delta: number) =>
    socket.emit('score:adjust', { player, delta }),
  autoObjectives: () => socket.emit('objectives:auto'),
  rollOff: () => socket.emit('game:rollOff'),
  setPrimaryMission: (id: string) => socket.emit('mission:setPrimary', { id }),
  ping: (x: number, y: number) => socket.emit('ping:add', { x, y }),
  deployAll: () => socket.emit('army:deployAll'),
  clearMyTokens: () => socket.emit('tokens:clearMine'),
};
