import { useGame, intents } from '../state/gameStore';
import { PRIMARY_MISSIONS, PRIMARY_BY_ID, SECONDARY_BY_ID } from '../data/missions';

export default function MissionsPanel({ onClose }: { onClose: () => void }) {
  const state = useGame((s) => s.state);
  const secDeck = useGame((s) => s.secDeck);
  const secHand = useGame((s) => s.secHand);
  const secDiscard = useGame((s) => s.secDiscard);
  const secShuffle = useGame((s) => s.secShuffle);
  const secDraw = useGame((s) => s.secDraw);
  const secDiscardCard = useGame((s) => s.secDiscardCard);

  const primary = state?.primaryMissionId ? PRIMARY_BY_ID[state.primaryMissionId] : undefined;
  const deckReady = secDeck.length > 0 || secHand.length > 0 || secDiscard.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 style={{ margin: 0 }}>Missions</h2>
          <span className="spacer" />
          <button onClick={onClose}>Close ✕</button>
        </div>

        <p className="small muted" style={{ marginTop: 6 }}>
          Brief reminders only — use your official mission cards for the exact rules.
        </p>

        {/* ---- Primary mission (shared) ---- */}
        <section style={{ marginTop: 8 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>Primary mission</h3>
            <span className="spacer" />
            <select
              value={state?.primaryMissionId ?? ''}
              onChange={(e) => intents.setPrimaryMission(e.target.value)}
            >
              <option value="">— choose —</option>
              {PRIMARY_MISSIONS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          {primary ? (
            <div className="card" style={{ marginTop: 8 }}>
              <div className="row">
                <strong>{primary.name}</strong>
                <span className="badge warn">{primary.vp} VP</span>
              </div>
              <div className="small" style={{ marginTop: 4 }}>{primary.summary}</div>
            </div>
          ) : (
            <p className="small muted">No primary mission selected (shared with both players).</p>
          )}
        </section>

        {/* ---- Tactical secondary deck (private to you) ---- */}
        <section style={{ marginTop: 16 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>Secondary deck — Tactical</h3>
            <span className="spacer" />
            <span className="small muted">deck {secDeck.length} · discard {secDiscard.length}</span>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button onClick={secShuffle}>{deckReady ? 'Reshuffle deck' : 'Shuffle deck'}</button>
            <button className="primary" onClick={secDraw} disabled={!deckReady}>Draw card</button>
            <span className="small muted">private to you</span>
          </div>

          {secHand.length === 0 ? (
            <p className="small muted" style={{ marginTop: 8 }}>
              {deckReady ? 'No cards in hand — draw one.' : 'Shuffle the deck to start drawing.'}
            </p>
          ) : (
            <div style={{ marginTop: 8 }}>
              {secHand.map((id) => {
                const c = SECONDARY_BY_ID[id];
                if (!c) return null;
                return (
                  <div key={id} className="card" style={{ marginBottom: 8 }}>
                    <div className="row">
                      <strong>{c.name}</strong>
                      <span className="badge warn">{c.vp} VP</span>
                      <span className="spacer" />
                      <button onClick={() => secDiscardCard(id)} title="Discard (e.g. after scoring or to redraw next turn)">
                        Discard
                      </button>
                    </div>
                    <div className="small" style={{ marginTop: 4 }}>{c.summary}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
