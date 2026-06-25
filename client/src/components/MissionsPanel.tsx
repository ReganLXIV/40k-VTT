import { useGame, intents } from '../state/gameStore';
import {
  PRIMARY_MISSIONS,
  PRIMARY_BY_ID,
  SECONDARY_CARDS,
  SECONDARY_BY_ID,
} from '../data/missions';

export default function MissionsPanel({ onClose }: { onClose: () => void }) {
  const state = useGame((s) => s.state);
  const secMode = useGame((s) => s.secMode);
  const secDeck = useGame((s) => s.secDeck);
  const secHand = useGame((s) => s.secHand);
  const secDiscard = useGame((s) => s.secDiscard);
  const secFixed = useGame((s) => s.secFixed);
  const setSecMode = useGame((s) => s.setSecMode);
  const secShuffle = useGame((s) => s.secShuffle);
  const secDraw = useGame((s) => s.secDraw);
  const secDiscardCard = useGame((s) => s.secDiscardCard);
  const secFixedToggle = useGame((s) => s.secFixedToggle);

  const primary = state?.primaryMissionId ? PRIMARY_BY_ID[state.primaryMissionId] : undefined;
  const deckReady = secDeck.length > 0 || secHand.length > 0 || secDiscard.length > 0;
  const drawTwo = () => {
    secDraw();
    secDraw();
  };

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
          <p className="small muted" style={{ marginTop: 4 }}>
            Up to 45 VP total (max 15 per round); from round 2 you must hold an objective outside
            your deployment zone to score.
          </p>
        </section>

        {/* ---- Secondary missions (private to you) ---- */}
        <section style={{ marginTop: 16 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>Secondary missions</h3>
            <span className="spacer" />
            <div className="row" style={{ gap: 4 }}>
              <button
                className={`toolbtn ${secMode === 'tactical' ? 'active' : ''}`}
                onClick={() => setSecMode('tactical')}
              >
                Tactical
              </button>
              <button
                className={`toolbtn ${secMode === 'fixed' ? 'active' : ''}`}
                onClick={() => setSecMode('fixed')}
              >
                Fixed
              </button>
            </div>
          </div>
          <p className="small muted" style={{ marginTop: 4 }}>
            Chosen once at the start of the game — private to you.
          </p>

          {secMode === 'tactical' ? (
            <>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <span className="small muted">deck {secDeck.length} · discard {secDiscard.length}</span>
                <span className="spacer" />
                <button onClick={secShuffle}>{deckReady ? 'Reshuffle' : 'Shuffle deck'}</button>
                <button onClick={secDraw} disabled={!deckReady}>Draw 1</button>
                <button className="primary" onClick={drawTwo} disabled={!deckReady}>Draw 2 (turn)</button>
              </div>

              {secHand.length === 0 ? (
                <p className="small muted" style={{ marginTop: 8 }}>
                  {deckReady ? 'No cards in hand — draw 2 at the start of your turn.' : 'Shuffle the deck to start drawing.'}
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
                          <button onClick={() => secDiscardCard(id)} title="Discard (after scoring, or to redraw next turn)">
                            Discard
                          </button>
                        </div>
                        <div className="small" style={{ marginTop: 4 }}>{c.summary}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="small muted" style={{ marginTop: 6 }}>
                Pick the two secondaries you'll score every turn ({secFixed.length}/2 chosen).
              </p>
              <div style={{ marginTop: 6 }}>
                {SECONDARY_CARDS.map((c) => {
                  const chosen = secFixed.includes(c.id);
                  const disabled = !chosen && secFixed.length >= 2;
                  return (
                    <div
                      key={c.id}
                      className="card"
                      style={{
                        marginBottom: 6,
                        opacity: disabled ? 0.5 : 1,
                        outline: chosen ? '2px solid #ffd84e' : 'none',
                      }}
                    >
                      <div className="row">
                        <strong>{c.name}</strong>
                        <span className="badge warn">{c.vp} VP</span>
                        <span className="spacer" />
                        <button
                          className={`toolbtn ${chosen ? 'active' : ''}`}
                          disabled={disabled}
                          onClick={() => secFixedToggle(c.id)}
                        >
                          {chosen ? 'Chosen ✓' : 'Choose'}
                        </button>
                      </div>
                      <div className="small" style={{ marginTop: 4 }}>{c.summary}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
