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
  const [infos, setInfos] = useState<(DetachmentInfo | { error: string; name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!faction || detachments.length === 0) {
      setInfos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(
      detachments.map((name) =>
        fetch(`/api/detachment?faction=${encodeURIComponent(faction)}&name=${encodeURIComponent(name)}`)
          .then(async (r) => {
            if (!r.ok) throw new Error((await r.json()).error || 'not found');
            return r.json() as Promise<DetachmentInfo>;
          })
          .catch((e) => ({ error: String(e.message || e), name }))
      )
    )
      .then(setInfos)
      .finally(() => setLoading(false));
  }, [faction, detachments.join('|')]);

  const budget = dpBudget(points);
  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());

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
          <span className="badge warn">
            Detachment Points: {budget.dp ?? '—'} ({budget.size})
          </span>
          <span className="muted">
            {detachments.length} detachment{detachments.length === 1 ? '' : 's'} fielded
            {detachments.length > 0 && ` — ${detachments.join(', ')}`}
          </span>
        </div>
        <p className="small muted" style={{ marginTop: 4 }}>
          11th ed armies may take multiple detachments (each costs 1–3 DP). New Recruit currently
          exports a single detachment, so only that one is shown until its export adds more.
        </p>

        <div className="row" style={{ marginTop: 8 }}>
          <span className="spacer" />
          <input placeholder="filter stratagems…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {loading && <p className="muted">Loading…</p>}
        {!loading && detachments.length === 0 && (
          <div className="badge bad" style={{ marginTop: 8 }}>No detachment on your imported army.</div>
        )}

        {infos.map((info, idx) =>
          'error' in info ? (
            <div key={idx} className="badge bad" style={{ marginTop: 8 }}>
              {info.name}: {info.error}
            </div>
          ) : (
            <section key={idx} style={{ marginTop: 16, borderTop: '1px solid #2a2a2a', paddingTop: 10 }}>
              <h2 style={{ margin: '0 0 8px' }}>{info.detachment}</h2>

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
                <h3 style={{ margin: 0 }}>Stratagems ({info.stratagems.filter((s) => match(s.name) || match(s.phase) || match(s.type)).length})</h3>
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
            </section>
          )
        )}
      </div>
    </div>
  );
}
