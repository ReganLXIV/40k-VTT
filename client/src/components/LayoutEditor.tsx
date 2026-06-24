import { useEffect, useRef, useState } from 'react';
import type { BoardSize, Layout, Objective, Point, TerrainArea } from '@shared/types';
import { computeView, inchesToPx, pxToInches, type ViewParams } from '../board/coords';

const SIZES: Record<BoardSize, { w: number; h: number }> = {
  strike_force: { w: 60, h: 44 },
  incursion: { w: 44, h: 30 },
  combat_patrol: { w: 30, h: 22 },
};

type Mode = 'move' | 'addRect' | 'addTri' | 'addCircle' | 'addObj' | 'zone1' | 'zone2';

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${seq++}`;

function blankLayout(size: BoardSize): Layout {
  const { w, h } = SIZES[size];
  return {
    id: uid('layout'),
    name: 'New layout',
    boardSize: size,
    width: w,
    height: h,
    terrain: [],
    objectives: [],
    deploymentZones: [
      { player: 'player1', polygon: [0, h * 0.7, w, h * 0.7, w, h, 0, h] },
      { player: 'player2', polygon: [0, 0, w, 0, w, h * 0.3, 0, h * 0.3] },
    ],
  };
}

export default function LayoutEditor({
  initial,
  onApply,
  onClose,
}: {
  initial: Layout;
  onApply: (l: Layout) => void;
  onClose: () => void;
}) {
  const [layout, setLayout] = useState<Layout>(() => structuredClone(initial));
  const [mode, setMode] = useState<Mode>('move');
  const [selId, setSelId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<ViewParams | null>(null);
  const dragRef = useRef<{ kind: 'terrain' | 'obj'; id: string; off: Point } | null>(null);
  const zoneDragRef = useRef<{ player: 'player1' | 'player2'; a: Point; b: Point } | null>(null);

  const W = 520, H = 400;

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const v = computeView(layout.width, layout.height, W, H, false, 16, 0);
    viewRef.current = v;
    draw(ctx, v, layout, selId, zoneDragRef.current);
  }, [layout, selId]);

  const toCanon = (e: React.MouseEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return pxToInches({ x: e.clientX - rect.left, y: e.clientY - rect.top }, viewRef.current!);
  };

  const onDown = (e: React.MouseEvent) => {
    const p = toCanon(e);
    if (mode === 'addRect') {
      add({ id: uid('t'), shape: 'rect', geom: [p.x - 3.5, p.y - 5.75, 7, 11.5], label: 'Ruin', obscuring: true });
      return;
    }
    if (mode === 'addTri') {
      add({ id: uid('t'), shape: 'triangle', geom: [p.x - 4, p.y + 5.75, p.x + 4, p.y + 5.75, p.x, p.y - 5.75], label: 'Ruin', obscuring: true });
      return;
    }
    if (mode === 'addCircle') {
      add({ id: uid('t'), shape: 'circle', geom: [p.x, p.y, 3], label: 'Crater' });
      return;
    }
    if (mode === 'addObj') {
      const o: Objective = { id: uid('obj'), cx: p.x, cy: p.y, type: 'central', radiusInch: 3, controlledBy: null };
      setLayout((l) => ({ ...l, objectives: [...l.objectives, o] }));
      setSelId(o.id);
      return;
    }
    if (mode === 'zone1' || mode === 'zone2') {
      zoneDragRef.current = { player: mode === 'zone1' ? 'player1' : 'player2', a: p, b: p };
      return;
    }
    // move mode: pick object
    const obj = layout.objectives.find((o) => Math.hypot(o.cx - p.x, o.cy - p.y) <= Math.max(o.radiusInch, 1.5));
    if (obj) {
      setSelId(obj.id);
      dragRef.current = { kind: 'obj', id: obj.id, off: { x: p.x - obj.cx, y: p.y - obj.cy } };
      return;
    }
    const ter = [...layout.terrain].reverse().find((t) => hitTerrain(p, t));
    if (ter) {
      setSelId(ter.id);
      const anchor = terrainAnchor(ter);
      dragRef.current = { kind: 'terrain', id: ter.id, off: { x: p.x - anchor.x, y: p.y - anchor.y } };
    } else {
      setSelId(null);
    }
  };

  const onMove = (e: React.MouseEvent) => {
    const p = toCanon(e);
    if (zoneDragRef.current) {
      zoneDragRef.current = { ...zoneDragRef.current, b: p };
      // trigger redraw
      const v = viewRef.current!;
      draw(canvasRef.current!.getContext('2d')!, v, layout, selId, zoneDragRef.current);
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'obj') {
      setLayout((l) => ({
        ...l,
        objectives: l.objectives.map((o) => (o.id === d.id ? { ...o, cx: p.x - d.off.x, cy: p.y - d.off.y } : o)),
      }));
    } else {
      setLayout((l) => ({
        ...l,
        terrain: l.terrain.map((t) => (t.id === d.id ? moveTerrain(t, { x: p.x - d.off.x, y: p.y - d.off.y }) : t)),
      }));
    }
  };

  const onUp = () => {
    if (zoneDragRef.current) {
      const { player, a, b } = zoneDragRef.current;
      const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
      const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
      setLayout((l) => ({
        ...l,
        deploymentZones: l.deploymentZones.map((z) =>
          z.player === player ? { ...z, polygon: [x0, y0, x1, y0, x1, y1, x0, y1] } : z
        ),
      }));
      zoneDragRef.current = null;
      setMode('move');
    }
    dragRef.current = null;
  };

  const add = (t: TerrainArea) => {
    setLayout((l) => ({ ...l, terrain: [...l.terrain, t] }));
    setSelId(t.id);
    setMode('move');
  };

  const deleteSel = () => {
    if (!selId) return;
    setLayout((l) => ({
      ...l,
      terrain: l.terrain.filter((t) => t.id !== selId),
      objectives: l.objectives.filter((o) => o.id !== selId),
    }));
    setSelId(null);
  };

  const setSize = (size: BoardSize) => {
    const { w, h } = SIZES[size];
    setLayout((l) => ({ ...l, boardSize: size, width: w, height: h }));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layout.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as Layout;
      setLayout(data);
    } catch {
      alert('Invalid layout JSON');
    }
  };

  const selTerrain = layout.terrain.find((t) => t.id === selId);
  const selObj = layout.objectives.find((o) => o.id === selId);

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>Layout editor</h3>
        <span className="spacer" />
        <button onClick={onClose}>Close</button>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <input value={layout.name} onChange={(e) => setLayout((l) => ({ ...l, name: e.target.value }))} style={{ width: 200 }} />
        <select value={layout.boardSize} onChange={(e) => setSize(e.target.value as BoardSize)}>
          <option value="strike_force">Strike Force 60×44</option>
          <option value="incursion">Incursion 44×30</option>
          <option value="combat_patrol">Combat Patrol 30×22</option>
        </select>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        {(['move', 'addRect', 'addTri', 'addCircle', 'addObj', 'zone1', 'zone2'] as Mode[]).map((m) => (
          <button key={m} className={`toolbtn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
            {labelFor(m)}
          </button>
        ))}
        <button className="danger" onClick={deleteSel} disabled={!selId}>Delete selected</button>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 6, cursor: mode === 'move' ? 'move' : 'crosshair' }}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      />

      {selTerrain && (
        <div className="row" style={{ marginTop: 8 }}>
          <span className="small muted">Terrain {selTerrain.shape}</span>
          <input value={selTerrain.label ?? ''} placeholder="label"
            onChange={(e) => updTerrain(setLayout, selTerrain.id, { label: e.target.value })} style={{ width: 100 }} />
          {selTerrain.shape === 'rect' && (
            <>
              <NumIn label="w" v={selTerrain.geom[2]} on={(n) => geomSet(setLayout, selTerrain.id, 2, n)} />
              <NumIn label="h" v={selTerrain.geom[3]} on={(n) => geomSet(setLayout, selTerrain.id, 3, n)} />
            </>
          )}
          {selTerrain.shape === 'circle' && (
            <NumIn label="r" v={selTerrain.geom[2]} on={(n) => geomSet(setLayout, selTerrain.id, 2, n)} />
          )}
          <label className="small">
            <input type="checkbox" checked={!!selTerrain.obscuring}
              onChange={(e) => updTerrain(setLayout, selTerrain.id, { obscuring: e.target.checked })} /> obscuring
          </label>
        </div>
      )}

      {selObj && (
        <div className="row" style={{ marginTop: 8 }}>
          <span className="small muted">Objective</span>
          <select value={selObj.type} onChange={(e) =>
            setLayout((l) => ({ ...l, objectives: l.objectives.map((o) => o.id === selObj.id ? { ...o, type: e.target.value as Objective['type'] } : o) }))
          }>
            <option value="home">home</option>
            <option value="expansion">expansion</option>
            <option value="central">central</option>
          </select>
          <NumIn label="radius" v={selObj.radiusInch} on={(n) =>
            setLayout((l) => ({ ...l, objectives: l.objectives.map((o) => o.id === selObj.id ? { ...o, radiusInch: n } : o) }))
          } />
        </div>
      )}

      <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" onClick={() => onApply(layout)}>Apply to table</button>
        <button onClick={exportJson}>Export JSON</button>
        <label className="small" style={{ cursor: 'pointer' }}>
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => importJson(e.target.files?.[0])} />
          <span className="badge">Import JSON…</span>
        </label>
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>
        Tip: pick a tool, click the board to add; switch to Move to drag pieces. Zone tools: drag a rectangle.
      </p>
    </div>
  );
}

function NumIn({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return (
    <label className="small">
      {label} <input type="number" step={0.5} value={v} onChange={(e) => on(+e.target.value)} style={{ width: 60 }} />
    </label>
  );
}

function labelFor(m: Mode): string {
  return { move: 'Move', addRect: '+ Rect', addTri: '+ Triangle', addCircle: '+ Circle', addObj: '+ Objective', zone1: 'Zone P1', zone2: 'Zone P2' }[m];
}

function geomSet(setLayout: (fn: (l: Layout) => Layout) => void, id: string, idx: number, n: number) {
  setLayout((l) => ({ ...l, terrain: l.terrain.map((t) => t.id === id ? { ...t, geom: t.geom.map((g, i) => (i === idx ? n : g)) } : t) }));
}
function updTerrain(setLayout: (fn: (l: Layout) => Layout) => void, id: string, patch: Partial<TerrainArea>) {
  setLayout((l) => ({ ...l, terrain: l.terrain.map((t) => t.id === id ? { ...t, ...patch } : t) }));
}

function terrainAnchor(t: TerrainArea): Point {
  if (t.shape === 'rect') return { x: t.geom[0], y: t.geom[1] };
  if (t.shape === 'circle') return { x: t.geom[0], y: t.geom[1] };
  return { x: t.geom[0], y: t.geom[1] }; // triangle first vertex
}
function moveTerrain(t: TerrainArea, anchor: Point): TerrainArea {
  const cur = terrainAnchor(t);
  const dx = anchor.x - cur.x, dy = anchor.y - cur.y;
  if (t.shape === 'rect') return { ...t, geom: [t.geom[0] + dx, t.geom[1] + dy, t.geom[2], t.geom[3]] };
  if (t.shape === 'circle') return { ...t, geom: [t.geom[0] + dx, t.geom[1] + dy, t.geom[2]] };
  return { ...t, geom: [t.geom[0] + dx, t.geom[1] + dy, t.geom[2] + dx, t.geom[3] + dy, t.geom[4] + dx, t.geom[5] + dy] };
}
function hitTerrain(p: Point, t: TerrainArea): boolean {
  if (t.shape === 'rect') {
    const [x, y, w, h] = t.geom;
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  }
  if (t.shape === 'circle') {
    const [cx, cy, r] = t.geom;
    return Math.hypot(p.x - cx, p.y - cy) <= r;
  }
  // triangle bbox approx
  const xs = [t.geom[0], t.geom[2], t.geom[4]], ys = [t.geom[1], t.geom[3], t.geom[5]];
  return p.x >= Math.min(...xs) && p.x <= Math.max(...xs) && p.y >= Math.min(...ys) && p.y <= Math.max(...ys);
}

function draw(ctx: CanvasRenderingContext2D, v: ViewParams, layout: Layout, selId: string | null, zoneDrag: any) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const tl = inchesToPx({ x: 0, y: 0 }, v);
  const br = inchesToPx({ x: layout.width, y: layout.height }, v);
  ctx.fillStyle = '#1a2b1f';
  ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  ctx.strokeStyle = '#3c5a44';
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

  for (const z of layout.deploymentZones) {
    ctx.beginPath();
    for (let i = 0; i < z.polygon.length; i += 2) {
      const pt = inchesToPx({ x: z.polygon[i], y: z.polygon[i + 1] }, v);
      i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.fillStyle = z.player === 'player1' ? 'rgba(78,161,255,0.15)' : 'rgba(255,93,93,0.15)';
    ctx.fill();
  }

  for (const t of layout.terrain) {
    ctx.fillStyle = 'rgba(120,130,140,0.25)';
    ctx.strokeStyle = t.id === selId ? '#fff' : 'rgba(200,210,220,0.6)';
    ctx.lineWidth = t.id === selId ? 2 : 1;
    ctx.beginPath();
    if (t.shape === 'rect') {
      const [x, y, w, h] = t.geom;
      const a = inchesToPx({ x, y }, v), b = inchesToPx({ x: x + w, y: y + h }, v);
      ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else if (t.shape === 'triangle') {
      const p0 = inchesToPx({ x: t.geom[0], y: t.geom[1] }, v);
      const p1 = inchesToPx({ x: t.geom[2], y: t.geom[3] }, v);
      const p2 = inchesToPx({ x: t.geom[4], y: t.geom[5] }, v);
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.closePath();
    } else {
      const c = inchesToPx({ x: t.geom[0], y: t.geom[1] }, v);
      ctx.arc(c.x, c.y, t.geom[2] * v.scale, 0, Math.PI * 2);
    }
    ctx.fill(); ctx.stroke();
  }

  for (const o of layout.objectives) {
    const c = inchesToPx({ x: o.cx, y: o.cy }, v);
    ctx.beginPath(); ctx.arc(c.x, c.y, o.radiusInch * v.scale, 0, Math.PI * 2);
    ctx.strokeStyle = o.id === selId ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = o.type === 'home' ? '#9b8cff' : o.type === 'expansion' ? '#ffb454' : '#5ad17a';
    ctx.fill();
  }

  if (zoneDrag) {
    const a = inchesToPx(zoneDrag.a, v), b = inchesToPx(zoneDrag.b, v);
    ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 4]);
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.setLineDash([]);
  }
}

export { blankLayout };
