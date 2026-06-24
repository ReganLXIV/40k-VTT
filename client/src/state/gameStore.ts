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

  setMyRoster: (r: HydratedRoster | null) => void;
  setSelectedToken: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  setTool: (t: Tool) => void;
  toggleGrid: () => void;
  toggleRanges: () => void;
  setRangeRing: (n: number) => void;

  flip: boolean; // does this client render flipped (player2)?
}

export const useGame = create<GameStore>((set, get) => {
  socket.on('connect', () => set({ connected: true }));
  socket.on('disconnect', () => set({ connected: false }));

  const onState = (state: RoomState) => {
    set({ state });
    // drop selections for tokens that vanished
    const ids = new Set(state.tokens.map((t) => t.id));
    const sel = get().selectedTokenId;
    if (sel && !ids.has(sel)) set({ selectedTokenId: null });
    const multi = get().selectedIds;
    if (multi.some((id) => !ids.has(id))) set({ selectedIds: multi.filter((id) => ids.has(id)) });
  };
  socket.on('state:full', onState);
  socket.on('state:patch', onState);
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
    flip: false,

    setMyRoster: (r) => set({ myRoster: r }),
    setSelectedToken: (id) => set({ selectedTokenId: id }),
    setSelectedIds: (ids) => set({ selectedIds: ids }),
    setTool: (t) => set({ tool: t }),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    toggleRanges: () => set((s) => ({ showRanges: !s.showRanges })),
    setRangeRing: (n) => set({ rangeRingInch: Math.max(1, Math.min(60, n)) }),
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
  ping: (x: number, y: number) => socket.emit('ping:add', { x, y }),
  deployAll: () => socket.emit('army:deployAll'),
  clearMyTokens: () => socket.emit('tokens:clearMine'),
};
