import { useEffect, useRef, useState, useCallback } from 'react';
import type { Point, Token } from '@shared/types';
import { useGame, intents, livePings } from '../state/gameStore';
import { computeView, pxToInches, inchesToPx, fullArc, type ViewParams } from './coords';
import { renderBoard } from './render';
import { clampToBoard, objectiveAt, tokenAt } from './interactions';

interface QuickMenu {
  tokenId: string;
  screenX: number;
  screenY: number;
}

const MOVE_THROTTLE_MS = 40;

export default function BoardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const state = useGame((s) => s.state);
  const slot = useGame((s) => s.slot);
  const flip = useGame((s) => s.flip);
  const tool = useGame((s) => s.tool);
  const showGrid = useGame((s) => s.showGrid);
  const selectedTokenId = useGame((s) => s.selectedTokenId);
  const setSelectedToken = useGame((s) => s.setSelectedToken);

  const [quickMenu, setQuickMenu] = useState<QuickMenu | null>(null);

  // mutable interaction state kept in refs so the rAF loop sees latest without re-binding
  const viewRef = useRef<ViewParams | null>(null);
  const dragRef = useRef<{ id: string; offset: Point; start: Point } | null>(null);
  const localPosRef = useRef<Map<string, Point>>(new Map());
  const rulerRef = useRef<{ a: Point; b: Point } | null>(null);
  const downRef = useRef<{ p: Point; moved: boolean } | null>(null);
  const lastEmitRef = useRef(0);
  // marquee multi-select + group drag (move a block of models together)
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const marqueeRef = useRef<{ a: Point; b: Point } | null>(null);
  const groupDragRef = useRef<{ ids: string[]; start: Map<string, Point>; anchor: Point } | null>(null);
  const rightRulerRef = useRef(false); // right-drag is measuring
  const rightMovedRef = useRef(false); // suppress context menu if right-drag moved
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const baseRef = useRef<ViewParams | null>(null);
  const panDragRef = useRef<{ lastX: number; lastY: number } | null>(null);

  // Keyboard shortcuts: Delete removes selection; arrows nudge the selection
  // (Shift = fine 0.5"); V/S select, R ruler, P ping, G grid. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      const gs = useGame.getState();
      const selIds =
        selectedIdsRef.current.size > 0
          ? [...selectedIdsRef.current]
          : gs.selectedTokenId
            ? [gs.selectedTokenId as string]
            : [];

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selIds.length) return;
        e.preventDefault();
        for (const id of selIds) intents.remove(id);
        selectedIdsRef.current = new Set();
        gs.setSelectedIds([]);
        setSelectedToken(null);
        return;
      }

      if (e.key.startsWith('Arrow')) {
        const st = gs.state;
        if (!selIds.length || !st) return;
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 1;
        const sign = gs.flip ? -1 : 1; // player2 view is rotated 180°
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        else if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        dx *= sign;
        dy *= sign;
        for (const id of selIds) {
          const t = st.tokens.find((tk) => tk.id === id);
          if (!t) continue;
          const p = clampToBoard({ x: t.x + dx, y: t.y + dy }, st.layout);
          intents.move(id, p.x, p.y);
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'v' || k === 's') gs.setTool('select');
      else if (k === 'r') gs.setTool('ruler');
      else if (k === 'p') gs.setTool('ping');
      else if (k === 'g') gs.toggleGrid();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSelectedToken]);

  // ---- render loop ----
  useEffect(() => {
    let raf = 0;
    let renderErrLogged = false;
    const loop = () => {
      try {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      const st = useGame.getState().state;
      if (canvas && wrap && st) {
        const dpr = window.devicePixelRatio || 1;
        const cssW = wrap.clientWidth;
        const cssH = wrap.clientHeight;
        if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
          canvas.width = cssW * dpr;
          canvas.height = cssH * dpr;
          canvas.style.width = cssW + 'px';
          canvas.style.height = cssH + 'px';
        }
        const base = computeView(st.layout.width, st.layout.height, cssW * dpr, cssH * dpr, flip, 24 * dpr);
        baseRef.current = base;
        const v = withZoomPan(base, zoomRef.current, panRef.current, canvas.width / 2, canvas.height / 2);
        viewRef.current = v;
        const ctx = canvas.getContext('2d')!;

        // apply local drag override into a shallow copy of tokens
        const tokens = st.tokens.map((t) => {
          const lp = localPosRef.current.get(t.id);
          return lp ? { ...t, x: lp.x, y: lp.y } : t;
        });

        const gs = useGame.getState();
        renderBoard({
          ctx,
          v,
          state: { ...st, tokens },
          mySlot: gs.slot,
          selectedTokenId: gs.selectedTokenId,
          showGrid: gs.showGrid,
          liveRuler: rulerRef.current,
          showRanges: gs.showRanges,
          rangeRingInch: gs.rangeRingInch,
          dpr,
        });
        drawPings(ctx, v);
        drawSelection(ctx, v, tokens, selectedIdsRef.current, marqueeRef.current);
        // live distance while dragging a single token
        const dr = dragRef.current;
        if (dr) {
          const cur = localPosRef.current.get(dr.id) ?? dr.start;
          drawMeasureLine(ctx, v, dr.start, cur);
        }
      }
      } catch (err) {
        // A single bad frame must never permanently freeze the canvas: log once
        // and keep the loop alive so the board keeps refreshing.
        if (!renderErrLogged) {
          console.error('[board] render error (loop kept alive)', err);
          const msg = err instanceof Error ? `${err.message}` : String(err);
          useGame.setState({ renderError: msg });
          renderErrLogged = true;
        }
      } finally {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [flip]);

  const toCanonical = useCallback((e: React.MouseEvent | MouseEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const px = { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr };
    return pxToInches(px, viewRef.current!);
  }, []);

  // keep the board's marquee set mirrored to the store (so panels can act on it)
  const setSelIds = (ids: string[]) => {
    selectedIdsRef.current = new Set(ids);
    useGame.getState().setSelectedIds(ids);
  };

  // scroll wheel zooms about the cursor
  const onWheel = (e: React.WheelEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !viewRef.current || !baseRef.current) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cursor = { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr };
    const canon = pxToInches(cursor, viewRef.current);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomRef.current = Math.max(0.4, Math.min(6, zoomRef.current * factor));
    const newV = withZoomPan(baseRef.current, zoomRef.current, panRef.current, canvas.width / 2, canvas.height / 2);
    const newPx = inchesToPx(canon, newV);
    panRef.current = { x: panRef.current.x + (cursor.x - newPx.x), y: panRef.current.y + (cursor.y - newPx.y) };
  };

  const resetView = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setQuickMenu(null);
    const st = useGame.getState().state;
    if (!st || !viewRef.current) return;
    const p = toCanonical(e);

    // Middle mouse button = ping the opponent.
    if (e.button === 1) {
      e.preventDefault();
      intents.ping(p.x, p.y);
      return;
    }
    // Right mouse button = measure with the ruler (drag).
    if (e.button === 2) {
      rightRulerRef.current = true;
      rightMovedRef.current = false;
      rulerRef.current = { a: p, b: p };
      downRef.current = { p, moved: false };
      return;
    }
    // Pan tool: drag to pan the view.
    if (tool === 'pan') {
      panDragRef.current = { lastX: e.clientX, lastY: e.clientY };
      return;
    }

    downRef.current = { p, moved: false };

    // Ping: ping tool, or Alt-click in any tool, broadcasts intent.
    if (tool === 'ping' || e.altKey) {
      intents.ping(p.x, p.y);
      downRef.current = null;
      return;
    }

    if (tool === 'ruler') {
      rulerRef.current = { a: p, b: p };
      return;
    }
    const tok = tokenAt(p, st.tokens);
    if (tok) {
      // grabbing a token that's part of a multi-selection moves the whole block
      if (selectedIdsRef.current.has(tok.id) && selectedIdsRef.current.size > 1) {
        const ids = [...selectedIdsRef.current];
        const start = new Map<string, Point>();
        for (const id of ids) {
          const t = st.tokens.find((x) => x.id === id);
          if (t) start.set(id, { x: t.x, y: t.y });
        }
        groupDragRef.current = { ids, start, anchor: p };
      } else {
        setSelIds([tok.id]);
        setSelectedToken(tok.id);
        dragRef.current = { id: tok.id, offset: { x: p.x - tok.x, y: p.y - tok.y }, start: { x: tok.x, y: tok.y } };
      }
      return;
    }
    // empty board in select tool → start a marquee
    if (tool === 'select') {
      marqueeRef.current = { a: p, b: p };
      setSelIds([]);
      setSelectedToken(null);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (panDragRef.current) {
      const dpr = window.devicePixelRatio || 1;
      panRef.current = {
        x: panRef.current.x + (e.clientX - panDragRef.current.lastX) * dpr,
        y: panRef.current.y + (e.clientY - panDragRef.current.lastY) * dpr,
      };
      panDragRef.current = { lastX: e.clientX, lastY: e.clientY };
      return;
    }
    if (!viewRef.current || !downRef.current) return;
    const st = useGame.getState().state;
    if (!st) return;
    const p = toCanonical(e);
    if (Math.hypot(p.x - downRef.current.p.x, p.y - downRef.current.p.y) > 0.2) {
      downRef.current.moved = true;
    }

    // right-drag measuring
    if (rightRulerRef.current && rulerRef.current) {
      rightMovedRef.current = downRef.current.moved;
      rulerRef.current = { a: rulerRef.current.a, b: p };
      const now = performance.now();
      if (now - lastEmitRef.current > MOVE_THROTTLE_MS) {
        lastEmitRef.current = now;
        intents.ruler(rulerRef.current.a, rulerRef.current.b);
      }
      return;
    }

    if (tool === 'ruler' && rulerRef.current) {
      rulerRef.current = { a: rulerRef.current.a, b: p };
      const now = performance.now();
      if (now - lastEmitRef.current > MOVE_THROTTLE_MS) {
        lastEmitRef.current = now;
        intents.ruler(rulerRef.current.a, rulerRef.current.b);
      }
      return;
    }

    if (marqueeRef.current) {
      marqueeRef.current.b = p;
      return;
    }

    const group = groupDragRef.current;
    if (group) {
      const dx = p.x - group.anchor.x;
      const dy = p.y - group.anchor.y;
      const now = performance.now();
      const emit = now - lastEmitRef.current > MOVE_THROTTLE_MS;
      if (emit) lastEmitRef.current = now;
      for (const id of group.ids) {
        const s = group.start.get(id)!;
        const np = clampToBoard({ x: s.x + dx, y: s.y + dy }, st.layout);
        localPosRef.current.set(id, np);
        if (emit) intents.move(id, np.x, np.y);
      }
      return;
    }

    const drag = dragRef.current;
    if (drag) {
      const target = clampToBoard({ x: p.x - drag.offset.x, y: p.y - drag.offset.y }, st.layout);
      localPosRef.current.set(drag.id, target);
      const now = performance.now();
      if (now - lastEmitRef.current > MOVE_THROTTLE_MS) {
        lastEmitRef.current = now;
        intents.move(drag.id, target.x, target.y);
      }
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (panDragRef.current) {
      panDragRef.current = null;
      return;
    }
    const st = useGame.getState().state;
    const down = downRef.current;
    downRef.current = null;

    // finish a right-drag measurement
    if (rightRulerRef.current) {
      rightRulerRef.current = false;
      if (rulerRef.current) intents.ruler(rulerRef.current.a, rulerRef.current.b);
      return;
    }

    if (tool === 'ruler' && rulerRef.current) {
      intents.ruler(rulerRef.current.a, rulerRef.current.b);
      return;
    }

    if (marqueeRef.current) {
      const m = marqueeRef.current;
      marqueeRef.current = null;
      const x0 = Math.min(m.a.x, m.b.x), x1 = Math.max(m.a.x, m.b.x);
      const y0 = Math.min(m.a.y, m.b.y), y1 = Math.max(m.a.y, m.b.y);
      const mySlot = useGame.getState().slot;
      if (st && mySlot && mySlot !== 'spectator' && (x1 - x0 > 0.4 || y1 - y0 > 0.4)) {
        const ids = st.tokens
          .filter((t) => t.owner === mySlot && t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1)
          .map((t) => t.id);
        setSelIds(ids);
        setSelectedToken(ids.length === 1 ? ids[0] : null);
      }
      return;
    }

    const group = groupDragRef.current;
    if (group) {
      for (const id of group.ids) {
        const lp = localPosRef.current.get(id);
        if (lp) intents.move(id, lp.x, lp.y);
      }
      const ids = group.ids;
      setTimeout(() => ids.forEach((id) => localPosRef.current.delete(id)), 200);
      groupDragRef.current = null;
      return;
    }

    const drag = dragRef.current;
    if (drag) {
      const lp = localPosRef.current.get(drag.id);
      if (lp) intents.move(drag.id, lp.x, lp.y);
      // keep local override briefly; clear after server echo arrives next frame
      setTimeout(() => localPosRef.current.delete(drag.id), 200);
      dragRef.current = null;
      return;
    }

    // click (no drag) on empty space: maybe an objective, else deselect
    if (st && down && !down.moved) {
      const objId = objectiveAt(down.p, st.layout);
      if (objId) {
        cycleObjective(objId);
      } else if (!tokenAt(down.p, st.tokens)) {
        setSelectedToken(null);
      }
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // if the right-button was dragged, it was a measurement — don't open the menu
    if (rightMovedRef.current) {
      rightMovedRef.current = false;
      return;
    }
    const st = useGame.getState().state;
    if (!st || !viewRef.current) return;
    const p = toCanonical(e);
    const tok = tokenAt(p, st.tokens);
    if (tok) {
      setSelectedToken(tok.id);
      setQuickMenu({ tokenId: tok.id, screenX: e.clientX, screenY: e.clientY });
    }
  };

  const cycleObjective = (objId: string) => {
    const st = useGame.getState().state;
    if (!st) return;
    const cur = st.objectives[objId] ?? null;
    const next = cur === null ? 'player1' : cur === 'player1' ? 'player2' : null;
    intents.objective(objId, next);
  };

  const clearRuler = () => {
    rulerRef.current = null;
    intents.rulerClear();
  };

  const token: Token | undefined = state?.tokens.find((t) => t.id === quickMenu?.tokenId);

  return (
    <div className="board-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{ cursor: tool === 'pan' ? 'grab' : 'default' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onContextMenu={onContextMenu}
        onWheel={onWheel}
      />
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
        <button onClick={resetView} title="Reset zoom & pan">Reset view</button>
      </div>
      {(tool === 'ruler' || state?.ruler) && (
        <button style={{ position: 'absolute', top: 8, left: 8 }} onClick={clearRuler}>
          Clear ruler
        </button>
      )}
      {quickMenu && token && (
        <QuickMenuView
          token={token}
          x={quickMenu.screenX}
          y={quickMenu.screenY}
          onClose={() => setQuickMenu(null)}
        />
      )}
    </div>
  );
}

function QuickMenuView({
  token,
  x,
  y,
  onClose,
}: {
  token: Token;
  x: number;
  y: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = () => onClose();
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, [onClose]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="quick-menu" style={{ left: x, top: y }} onMouseDown={stop} onClick={stop}>
      <strong className="small">{token.label}</strong>
      <button
        onClick={() =>
          intents.update(token.id, { woundsCurrent: Math.max(0, token.woundsCurrent - 1) })
        }
      >
        −1 wound ({token.woundsCurrent}/{token.woundsMax})
      </button>
      <button
        onClick={() => {
          const v = prompt('Set current wounds', String(token.woundsCurrent));
          if (v !== null) intents.update(token.id, { woundsCurrent: Math.max(0, Number(v) || 0) });
        }}
      >
        Set wounds…
      </button>
      {token.modelsMax > 1 && (
        <button
          onClick={() =>
            intents.update(token.id, {
              modelsCurrent: Math.max(0, token.modelsCurrent - 1),
            })
          }
        >
          −1 model ({token.modelsCurrent}/{token.modelsMax})
        </button>
      )}
      <button
        onClick={() => {
          if (token.modelsMax > 1) {
            const perModel = Math.max(1, Math.round(token.woundsMax / token.modelsMax));
            intents.update(token.id, {
              modelsCurrent: Math.min(token.modelsMax, token.modelsCurrent + 1),
              woundsCurrent: Math.min(token.woundsMax, token.woundsCurrent + perModel),
            });
          } else {
            intents.clone(token.id, 1);
          }
        }}
      >
        Reanimate +1 ⟳
      </button>
      <button
        onClick={() => {
          const v = prompt('Status chips (comma separated)', token.status.join(', '));
          if (v !== null)
            intents.update(token.id, {
              status: v.split(',').map((s) => s.trim()).filter(Boolean),
            });
        }}
      >
        Edit status…
      </button>
      <button className="danger" onClick={() => { intents.remove(token.id); onClose(); }}>
        Remove token
      </button>
    </div>
  );
}

// apply zoom (about the viewport centre) + a pixel pan to a base view
function withZoomPan(
  base: ViewParams,
  z: number,
  pan: { x: number; y: number },
  cx: number,
  cy: number
): ViewParams {
  return {
    ...base,
    scale: base.scale * z,
    offsetX: base.offsetX - (z - 1) * (cx - base.offsetX) + pan.x,
    offsetY: base.offsetY - (z - 1) * (cy - base.offsetY) + pan.y,
  };
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  v: ViewParams,
  tokens: Token[],
  selectedIds: Set<string>,
  marquee: { a: Point; b: Point } | null
) {
  // highlight every token in the marquee multi-selection
  if (selectedIds.size > 1) {
    for (const t of tokens) {
      if (!selectedIds.has(t.id)) continue;
      const c = inchesToPx({ x: t.x, y: t.y }, v);
      const r = Math.max(8, (t.baseMm / 25.4 / 2) * v.scale) + 3;
      ctx.beginPath();
      fullArc(ctx, c.x, c.y, r);
      ctx.strokeStyle = '#ffd84e';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
  // marquee rectangle
  if (marquee) {
    const a = inchesToPx(marquee.a, v);
    const b = inchesToPx(marquee.b, v);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    ctx.fillStyle = 'rgba(255,216,78,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffd84e';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
}

function drawMeasureLine(ctx: CanvasRenderingContext2D, v: ViewParams, a: Point, b: Point) {
  const pa = inchesToPx(a, v);
  const pb = inchesToPx(b, v);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.strokeStyle = '#ffd84e';
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
}

const PING_MS = 2600;

function drawPings(ctx: CanvasRenderingContext2D, v: ViewParams) {
  const now = Date.now();
  // prune expired
  for (let i = livePings.length - 1; i >= 0; i--) {
    if (now - livePings[i].at > PING_MS) livePings.splice(i, 1);
  }
  for (const p of livePings) {
    const age = (now - p.at) / PING_MS; // 0..1
    const c = inchesToPx({ x: p.x, y: p.y }, v);
    const color = p.owner === 'player1' ? '#4ea1ff' : '#ff5d5d';
    const baseR = 6 * (window.devicePixelRatio || 1);
    // expanding fading rings
    for (const k of [0, 0.33]) {
      const t = (age + k) % 1;
      ctx.beginPath();
      fullArc(ctx, c.x, c.y, baseR + t * 34);
      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.max(0, 1 - t) * (1 - age * 0.3);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // solid centre dot
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.beginPath();
    fullArc(ctx, c.x, c.y, baseR);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
