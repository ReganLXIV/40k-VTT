import { GAME_PHASES, type PlayerSlot } from '@shared/types';
import { useGame, intents } from '../state/gameStore';

function Counter({
  label,
  value,
  onAdjust,
  color,
}: {
  label: string;
  value: number;
  onAdjust: (delta: number) => void;
  color: string;
}) {
  return (
    <div className="row" style={{ gap: 6 }}>
      <span className={`badge ${color}`} style={{ minWidth: 30, textAlign: 'center' }}>{label}</span>
      <button onClick={() => onAdjust(-1)} style={{ padding: '2px 8px' }}>−</button>
      <strong style={{ minWidth: 22, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
      <button onClick={() => onAdjust(1)} style={{ padding: '2px 8px' }}>＋</button>
    </div>
  );
}

export default function GameTrack() {
  const state = useGame((s) => s.state);
  if (!state) return null;
  const { phase, turn, activePlayer, commandPoints, score } = state;

  const p1Active = activePlayer === 'player1';

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row">
        <h3 style={{ margin: 0 }}>Battle round {turn}</h3>
        <span className="spacer" />
        <span className={`badge ${p1Active ? 'p1' : 'p2'}`}>
          {p1Active ? 'P1' : 'P2'} active
        </span>
      </div>

      {/* phase stepper */}
      <div className="row" style={{ gap: 3, marginTop: 8, flexWrap: 'wrap' }}>
        {GAME_PHASES.map((ph) => (
          <button
            key={ph}
            className={`toolbtn ${ph === phase ? 'active' : ''}`}
            style={{ padding: '3px 6px', fontSize: 11 }}
            onClick={() => intents.setPhase(ph)}
          >
            {ph}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="primary" style={{ flex: 1 }} onClick={() => intents.nextPhase()}>
          Next phase ▸
        </button>
        <button onClick={() => intents.nextTurn()} title="Hand turn to the other player">
          End turn
        </button>
      </div>

      {/* CP + VP */}
      <div className="col" style={{ marginTop: 10, gap: 8 }}>
        <div className="row">
          <span className="small muted" style={{ minWidth: 80 }}>Command pts</span>
          <Counter label="P1" color="p1" value={commandPoints.player1} onAdjust={(d) => intents.adjustCp('player1', d)} />
          <Counter label="P2" color="p2" value={commandPoints.player2} onAdjust={(d) => intents.adjustCp('player2', d)} />
        </div>
        <div className="row">
          <span className="small muted" style={{ minWidth: 80 }}>Victory pts</span>
          <Counter label="P1" color="p1" value={score.player1} onAdjust={(d) => intents.adjustScore('player1', d)} />
          <Counter label="P2" color="p2" value={score.player2} onAdjust={(d) => intents.adjustScore('player2', d)} />
        </div>
      </div>
    </div>
  );
}
