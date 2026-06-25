import { useEffect, useState } from 'react';
import type { DetachmentInfo } from '@shared/types';

// Detachment Points budget by game size (11th edition): Incursion (~1000 pts) = 2,
// Strike Force (~2000 pts) = 3. Detachments themselves cost 1–3 DP each.
function dpBudget(points?: number): { dp: number | null; size: string } {
  if (!points) return { dp: 3, size: 'Strike Force' };
  if (points >= 3000) return { dp: 4, size: 'Onslaught' };
  if (points >= 2000) return { dp: 3, size: 'Strike Force' };
  if (points >= 1000) return { dp: 2, size: 'Incursion' };
  return { dp: null, size: 'Combat Patrol' };
}

const selKey = (f?: string) => `vtt-det-${(f || '').toLowerCase()}`;
function loadSel(faction: string | undefined, fallback: string[]): string[] {
  try {
    const s = JSON.parse(localStorage.getItem(selKey(faction)) || 'null');
    if (Array.isArray(s)) return s;
  } catch {
    /* ignore */
  }
  return fallback;
}
function saveSel(faction: string | undefined, sel: string[]) {
  try {
    localStorage.setItem(selKey(faction), JSON.stringify(sel));
  } catch {
    /* ignore */
  }
}

type Info = DetachmentInfo | { error: string };

export default function DetachmentPanel({
  faction,
  detachments,
  points,
  onClose,
}: {
  faction?: string;
  detachments: string[];
  points?: number;
  onClose: () => void;
}) {
  const [available, setAvailable] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(() => loadSel(faction, detachments));
  const [infos, setInfos] = useState<Record<string, Info>>({});
  const [q, setQ] = useState('');

  // the faction's full detachment list (for the tickboxes)
  useEffect(() => {
    if (!faction) {
      setAvailable([]);
      return;
    }
    fetch(`/api/detachments?faction=${encodeURIComponent(faction)}`)
      .then((r) => r.json())
      .then((list: string[]) => setAvailable(Array.isArray(list) ? list : []))
      .catch(() => setAvailable([]));
  }, [faction]);

  // lazily fetch the rules/stratagems for each ticked detachment
  useEffect(() => {
    if (!faction) return;
    for (const name of selected) {
      if (infos[name]) continue;
      fetch(`/api/detachment?faction=${encodeURIComponent(faction)}&name=${encodeURIComponent(name)}`)
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).error || 'not found');
          return r.json() as Promise<DetachmentInfo>;
        })
        .then((info) => setInfos((p) => ({ ...p, [name]: info })))
        .catch((e) => setInfos((p) => ({ ...p, [name]: { error: String(e.message || e) } })));
    }
  }, [selected, faction]);

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      saveSel(faction, next);
      return next;
    });

  const budget = dpBudget(points);
  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  // show every faction detachment, plus any selected one not in the list (e.g. the parsed one)
  const options = [...new Set([...available, ...selected])];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 style={{ margin: 0 }}>Detachments</h2>
          {faction && <span className="badge">{faction}</span>}
          <span className="spacer" />
          <button onClick={onClose}>Close ✕</button>
        </div>

        <div className="row small" style={{ marginTop: 6, gap: 8, flexWrap: 'wrap' }}>
          <span className="badge warn">Detachment Points: {budget.dp ?? '—'} ({budget.size})</span>
          <span className="muted">{selected.length} selected</span>
        </div>
        <p className="small muted" style={{ marginTop: 4 }}>
          11th ed armies may take multiple detachments (each costs 1–3 DP). Tick the ones your
          list uses — New Recruit doesn't export multiples yet, so choose them here.
        </p>

        {/* tickbox chooser */}
        <div className="card" style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
          {options.length === 0 ? (
            <span className="small muted">No detachments found for this faction.</span>
          ) : (
            options.map((name) => (
              <label key={name} className="row small" style={{ gap: 8, padding: '2px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} />
                <span>{name}</span>
              </label>
            ))
          )}
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          <span className="spacer" />
          <input placeholder="filter stratagems…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {selected.length === 0 && (
          <p className="small muted" style={{ marginTop: 8 }}>Tick a detachment above to see its rules.</p>
        )}

        {selected.map((name) => {
          const info = infos[name];
          return (
            <section key={name} style={{ marginTop: 14, borderTop: '1px solid #2a2a2a', paddingTop: 10 }}>
              <h2 style={{ margin: '0 0 8px' }}>{name}</h2>
              {!info && <p className="muted small">Loading…</p>}
              {info && 'error' in info && <div className="badge bad">{info.error}</div>}
              {info && !('error' in info) && (
                <>
                  {info.abilities.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <h3>Detachment rule</h3>
                      {info.abilities.map((a, i) => (
                        <div key={i} className="card" style={{ marginBottom: 8 }}>
                          <strong>{a.name}</strong>
                          <div className="small" style={{ marginTop: 4 }}>{a.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {info.enhancements.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <h3>Enhancements</h3>
                      {info.enhancements.map((e, i) => (
                        <div key={i} className="card" style={{ marginBottom: 8 }}>
                          <div className="row">
                            <strong>{e.name}</strong>
                            <span className="badge warn">{e.cost} pts</span>
                          </div>
                          <div className="small" style={{ marginTop: 4 }}>{e.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <h3 style={{ margin: 0 }}>
                      Stratagems ({info.stratagems.filter((s) => match(s.name) || match(s.phase) || match(s.type)).length})
                    </h3>
                    {info.stratagems
                      .filter((s) => match(s.name) || match(s.phase) || match(s.type))
                      .map((s, i) => (
                        <div key={i} className="card" style={{ marginBottom: 8, marginTop: 8 }}>
                          <div className="row">
                            <strong>{s.name}</strong>
                            <span className="badge p1">{s.cpCost} CP</span>
                            <span className="spacer" />
                            <span className="small muted">{s.type}</span>
                          </div>
                          <div className="small muted" style={{ margin: '2px 0' }}>
                            {[s.turn, s.phase].filter(Boolean).join(' · ')}
                          </div>
                          <div className="small">{s.description}</div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
