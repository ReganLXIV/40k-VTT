import type { Server, Socket } from 'socket.io';
import { nanoid } from 'nanoid';
import type {
  ClientToServer,
  Layout,
  PlayerSlot,
  ServerToClient,
} from '../shared/types.js';
import { GAME_PHASES } from '../shared/types.js';
import {
  createRoom,
  deployAll,
  getRoom,
  markEmptyIfNeeded,
  setLayout,
  setRosterTokensCleared,
  spawnTokensFromUnit,
} from './rooms.js';

interface SocketData {
  code?: string;
  slot?: PlayerSlot | 'spectator';
}

type TServer = Server<ClientToServer, ServerToClient, {}, SocketData>;
type TSocket = Socket<ClientToServer, ServerToClient, {}, SocketData>;

// The layout's static geometry (terrain/objectives/zones/details) is large and
// never changes during play, so routine updates omit it — clients keep their
// cached copy and merge. Only an actual layout change resends the full geometry.
function lightLayout(l: Layout): Layout {
  return {
    id: l.id,
    name: l.name,
    boardSize: l.boardSize,
    width: l.width,
    height: l.height,
    terrain: [],
    objectives: [],
    deploymentZones: [],
  };
}

function broadcastFull(io: TServer, code: string) {
  const state = getRoom(code);
  if (state) io.to(code).emit('state:patch', { ...state, layout: lightLayout(state.layout) });
}

// Use when the layout itself changed: sends the full state incl. geometry.
function broadcastLayout(io: TServer, code: string) {
  const state = getRoom(code);
  if (state) io.to(code).emit('state:full', state);
}

export function registerHandlers(io: TServer, socket: TSocket) {
  const requireRoom = () => {
    const code = socket.data.code;
    if (!code) return null;
    return getRoom(code);
  };

  socket.on('room:create', (data, ack) => {
    const state = createRoom(data?.layoutId);
    socket.data.code = state.code;
    socket.data.slot = 'player1';
    state.players.player1 = { connected: true };
    socket.join(state.code);
    ack({ code: state.code, slot: 'player1', state });
  });

  socket.on('room:join', (data, ack) => {
    const state = getRoom(data.code?.toUpperCase?.() ?? data.code);
    if (!state) {
      ack({ error: 'Room not found' });
      return;
    }
    let slot: PlayerSlot | 'spectator';
    if (data.asSpectator) {
      slot = 'spectator';
    } else if (!state.players.player1?.connected) {
      slot = 'player1';
      state.players.player1 = { ...state.players.player1, connected: true };
    } else if (!state.players.player2?.connected) {
      slot = 'player2';
      state.players.player2 = { ...state.players.player2, connected: true };
    } else {
      slot = 'spectator';
    }
    socket.data.code = state.code;
    socket.data.slot = slot;
    socket.join(state.code);
    ack({ code: state.code, slot, state });
    broadcastFull(io, state.code);
  });

  socket.on('room:leave', () => {
    handleDisconnect(io, socket);
  });

  socket.on('army:set', ({ roster }) => {
    const state = requireRoom();
    const slot = socket.data.slot;
    if (!state || !slot || slot === 'spectator') return;
    state.players[slot] = { connected: true, roster };
    setRosterTokensCleared(state, slot); // re-import clears that player's tokens
    broadcastFull(io, state.code);
  });

  socket.on('layout:set', ({ layout }) => {
    const state = requireRoom();
    if (!state) return;
    setLayout(state, layout);
    broadcastLayout(io, state.code); // layout changed → resend full geometry
  });

  socket.on('token:spawn', ({ fromUnitId, asModels }) => {
    const state = requireRoom();
    const slot = socket.data.slot;
    if (!state || !slot || slot === 'spectator') return;
    spawnTokensFromUnit(state, slot, fromUnitId, !!asModels, () => nanoid(8));
    broadcastFull(io, state.code);
  });

  socket.on('token:move', ({ id, x, y }) => {
    const state = requireRoom();
    if (!state) return;
    const t = state.tokens.find((tk) => tk.id === id);
    if (t) {
      t.x = x;
      t.y = y;
      broadcastFull(io, state.code);
    }
  });

  socket.on('token:update', ({ id, partial }) => {
    const state = requireRoom();
    if (!state) return;
    const t = state.tokens.find((tk) => tk.id === id);
    if (t) {
      Object.assign(t, partial, { id: t.id, owner: t.owner }); // never let id/owner be overwritten
      // auto-tag destroyed at 0 wounds/models; clear the tag if revived
      const dead = t.woundsCurrent <= 0 || t.modelsCurrent <= 0;
      const hasTag = t.status.includes('Destroyed');
      if (dead && !hasTag) t.status = [...t.status, 'Destroyed'];
      else if (!dead && hasTag) t.status = t.status.filter((s) => s !== 'Destroyed');
      broadcastFull(io, state.code);
    }
  });

  socket.on('token:clone', ({ id, count }) => {
    const state = requireRoom();
    const slot = socket.data.slot;
    if (!state || !slot || slot === 'spectator') return;
    const src = state.tokens.find((t) => t.id === id);
    if (!src || src.owner !== slot) return;
    const n = Math.max(1, Math.min(50, count ?? 1));
    for (let i = 0; i < n; i++) {
      state.tokens.push({
        ...src,
        id: nanoid(8),
        x: Math.max(0, Math.min(state.layout.width, src.x + 1.3 * (i + 1))),
        y: Math.max(0, Math.min(state.layout.height, src.y + 0.6)),
        woundsCurrent: src.woundsMax,
        modelsCurrent: src.modelsMax,
        status: src.status.filter((s) => s !== 'Destroyed'),
      });
    }
    broadcastFull(io, state.code);
  });

  socket.on('token:remove', ({ id }) => {
    const state = requireRoom();
    if (!state) return;
    state.tokens = state.tokens.filter((tk) => tk.id !== id);
    broadcastFull(io, state.code);
  });

  socket.on('objective:set', ({ id, controlledBy }) => {
    const state = requireRoom();
    if (!state) return;
    if (id in state.objectives) {
      state.objectives[id] = controlledBy;
      broadcastFull(io, state.code);
    }
  });

  socket.on('dice:roll', ({ n, sides, label }) => {
    const state = requireRoom();
    const slot = socket.data.slot;
    if (!state || !slot || slot === 'spectator') return;
    const safeN = Math.max(1, Math.min(50, Math.floor(n)));
    const safeSides = Math.max(2, Math.min(100, Math.floor(sides)));
    const rolls: number[] = [];
    for (let i = 0; i < safeN; i++) {
      rolls.push(1 + Math.floor(Math.random() * safeSides));
    }
    state.dice.unshift({
      id: nanoid(6),
      owner: slot,
      label,
      n: safeN,
      sides: safeSides,
      rolls,
      total: rolls.reduce((a, b) => a + b, 0),
      at: Date.now(),
    });
    state.dice = state.dice.slice(0, 30); // cap log
    broadcastFull(io, state.code);
  });

  socket.on('dice:reroll1s', ({ id }) => {
    const state = requireRoom();
    const slot = socket.data.slot;
    if (!state || !slot || slot === 'spectator') return;
    const d = state.dice.find((x) => x.id === id);
    if (!d || d.owner !== slot || d.rolls.every((r) => r !== 1)) return;
    d.rolls = d.rolls.map((r) => (r === 1 ? 1 + Math.floor(Math.random() * d.sides) : r));
    d.total = d.rolls.reduce((a, b) => a + b, 0);
    if (!/rr1/.test(d.label ?? '')) d.label = `${d.label ?? `${d.n}d${d.sides}`} (rr1)`;
    d.at = Date.now();
    broadcastFull(io, state.code);
  });

  socket.on('ruler:set', ({ a, b }) => {
    const state = requireRoom();
    const slot = socket.data.slot;
    if (!state || !slot || slot === 'spectator') return;
    state.ruler = { a, b, owner: slot };
    broadcastFull(io, state.code);
  });

  socket.on('ruler:clear', () => {
    const state = requireRoom();
    if (!state) return;
    state.ruler = null;
    broadcastFull(io, state.code);
  });

  socket.on('turn:next', () => {
    const state = requireRoom();
    if (!state) return;
    state.activePlayer = state.activePlayer === 'player1' ? 'player2' : 'player1';
    if (state.activePlayer === 'player1') state.turn += 1;
    state.phase = 'Command';
    broadcastFull(io, state.code);
  });

  socket.on('notes:set', ({ text }) => {
    const state = requireRoom();
    const slot = socket.data.slot;
    if (!state || !slot || slot === 'spectator') return;
    state.notes[slot] = (text ?? '').slice(0, 4000);
    broadcastFull(io, state.code);
  });

  socket.on('phase:next', () => {
    const state = requireRoom();
    if (!state) return;
    const i = GAME_PHASES.indexOf(state.phase);
    if (i < GAME_PHASES.length - 1) {
      state.phase = GAME_PHASES[i + 1];
    } else {
      // end of Fight -> hand the turn to the other player (new round when back to p1)
      state.phase = 'Command';
      state.activePlayer = state.activePlayer === 'player1' ? 'player2' : 'player1';
      if (state.activePlayer === 'player1') state.turn += 1;
    }
    broadcastFull(io, state.code);
  });

  socket.on('phase:set', ({ phase }) => {
    const state = requireRoom();
    if (!state || !GAME_PHASES.includes(phase)) return;
    state.phase = phase;
    broadcastFull(io, state.code);
  });

  socket.on('ping:add', ({ x, y }) => {
    const state = requireRoom();
    const slot = socket.data.slot;
    if (!state || !slot || slot === 'spectator') return;
    io.to(state.code).emit('ping:show', { x, y, owner: slot, at: Date.now() });
  });

  socket.on('army:deployAll', () => {
    const state = requireRoom();
    const slot = socket.data.slot;
    if (!state || !slot || slot === 'spectator') return;
    deployAll(state, slot, () => nanoid(8));
    broadcastFull(io, state.code);
  });

  socket.on('tokens:clearMine', () => {
    const state = requireRoom();
    const slot = socket.data.slot;
    if (!state || !slot || slot === 'spectator') return;
    state.tokens = state.tokens.filter((t) => t.owner !== slot);
    broadcastFull(io, state.code);
  });

  socket.on('cp:adjust', ({ player, delta }) => {
    const state = requireRoom();
    if (!state || (player !== 'player1' && player !== 'player2')) return;
    state.commandPoints[player] = Math.max(0, (state.commandPoints[player] ?? 0) + delta);
    broadcastFull(io, state.code);
  });

  socket.on('score:adjust', ({ player, delta }) => {
    const state = requireRoom();
    if (!state || (player !== 'player1' && player !== 'player2')) return;
    state.score[player] = Math.max(0, (state.score[player] ?? 0) + delta);
    broadcastFull(io, state.code);
  });

  socket.on('disconnect', () => handleDisconnect(io, socket));
}

function handleDisconnect(io: TServer, socket: TSocket) {
  const code = socket.data.code;
  const slot = socket.data.slot;
  if (!code) return;
  const state = getRoom(code);
  if (state && slot && slot !== 'spectator' && state.players[slot]) {
    state.players[slot]!.connected = false;
    broadcastFull(io, code);
  }
  socket.leave(code);
  markEmptyIfNeeded(code);
  socket.data.code = undefined;
  socket.data.slot = undefined;
}
