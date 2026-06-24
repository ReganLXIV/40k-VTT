import { useEffect, useState } from 'react';
import type { DetachmentInfo } from '@shared/types';

export default function DetachmentPanel({
  faction,
  detachment,
  onClose,
}: {
  faction?: string;
  detachment?: string;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<DetachmentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!faction || !detachment) {
      setError('No faction/detachment on your imported army.');
      setLoading(false);
      return;
    }
    const url = `/api/detachment?faction=${encodeURIComponent(faction)}&name=${encodeURIComponent(detachment)}`;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'not found');
        return r.json();
      })
      .then(setInfo)
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [faction, detachment]);

  const strats = (info?.stratagems ?? []).filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q.toLowerCase()) ||
      s.phase.toLowerCase().includes(q.toLowerCase()) ||
      s.type.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 style={{ margin: 0 }}>{detachment ?? 'Detachment'}</h2>
          {faction && <span className="badge">{faction}</span>}
          <span className="spacer" />
          <button onClick={onClose}>Close ✕</button>
        </div>

        {loading && <p className="muted">Loading…</p>}
        {error && <div className="badge bad" style={{ marginTop: 8 }}>{error}</div>}

        {info && (
          <>
            {info.abilities.length > 0 && (
              <section style={{ marginTop: 12 }}>
                <h3>Detachment rule</h3>
                {info.abilities.map((a, i) => (
                  <div key={i} className="card" style={{ marginBottom: 8 }}>
                    <strong>{a.name}</strong>
                    <div className="small" style={{ marginTop: 4 }}>{a.description}</div>
                  </div>
                ))}
              </section>
            )}

            {info.enhancements.length > 0 && (
              <section style={{ marginTop: 12 }}>
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
              </section>
            )}

            <section style={{ marginTop: 12 }}>
              <div className="row">
                <h3 style={{ margin: 0 }}>Stratagems ({info.stratagems.length})</h3>
                <span className="spacer" />
                <input placeholder="filter…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              {strats.map((s, i) => (
                <div key={i} className="card" style={{ marginBottom: 8 }}>
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
              {strats.length === 0 && <p className="muted small">No stratagems match.</p>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
