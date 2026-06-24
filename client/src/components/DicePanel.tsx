import { useState } from 'react';
import { useGame, intents } from '../state/gameStore';

export default function DicePanel() {
  const dice = useGame((s) => s.state?.dice ?? []);
  const mySlot = useGame((s) => s.slot);
  const [n, setN] = useState(10);
  const [sides, setSides] = useState(6);
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState(0); // success threshold (e.g. 3 = 3+); 0 = off

  const roll = (nn: number, ss: number, lbl?: string) => intents.roll(nn, ss, lbl);

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Dice</h3>
      <div className="row">
        <button onClick={() => roll(1, 6, 'd6')}>1d6</button>
        <button onClick={() => roll(2, 6, 'Charge')}>2d6</button>
        <button onClick={() => roll(3, 6, '3d6')}>3d6</button>
        <button onClick={() => roll(6, 6, 'Volley')}>6d6</button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input type="number" min={1} max={50} value={n} onChange={(e) => setN(+e.target.value)} style={{ width: 52 }} />
        <span>d</span>
        <input type="number" min={2} max={100} value={sides} onChange={(e) => setSides(+e.target.value)} style={{ width: 52 }} />
        <input placeholder="label" value={label} onChange={(e) => setLabel(e.target.value)} style={{ width: 80 }} />
        <button className="primary" onClick={() => roll(n, sides, label || undefined)}>Roll</button>
      </div>
      <div className="row small" style={{ marginTop: 6 }}>
        <span className="muted">Count successes ≥</span>
        <input type="number" min={0} max={20} value={target} onChange={(e) => setTarget(+e.target.value)} style={{ width: 44 }} />
        <span className="muted">{target > 0 ? `(${target}+)` : 'off'}</span>
      </div>

      <div className="dice-log" style={{ marginTop: 10, maxHeight: 240, overflowY: 'auto' }}>
        {dice.length === 0 && <div className="small muted">No rolls yet.</div>}
        {dice.map((d) => {
          const sorted = [...d.rolls].sort((a, b) => a - b);
          const d6 = d.sides === 6;
          const successes = target > 0 && d6 ? sorted.filter((r) => r >= target).length : null;
          const crits = d6 ? sorted.filter((r) => r === 6).length : 0;
          const ones = sorted.filter((r) => r === 1).length;
          const mine = d.owner === mySlot;
          return (
            <div className="dice-entry" key={d.id}>
              <div className="row">
                <span className={`badge ${d.owner === 'player1' ? 'p1' : 'p2'}`}>
                  {d.owner === 'player1' ? 'P1' : 'P2'}
                </span>
                <span className="small">{d.label ?? `${d.n}d${d.sides}`}</span>
                <span className="spacer" />
                {successes !== null && (
                  <span className="badge good" title={`rolls ≥ ${target}`}>{successes} hit{successes === 1 ? '' : 's'}</span>
                )}
                {d6 && crits > 0 && (
                  <span className="badge warn" title="6s (criticals)">{crits} crit{crits === 1 ? '' : 's'}</span>
                )}
                <strong>Σ {d.total}</strong>
              </div>
              <div className="dice-rolls small" style={{ marginTop: 2 }}>
                {sorted.map((r, i) => {
                  const isFail = r === 1;
                  const isCrit = d6 && r === 6;
                  const isHit = target > 0 && r >= target;
                  const color = isFail ? '#ff6b6b' : isCrit ? '#ffd84e' : isHit ? '#5ad17a' : 'var(--muted)';
                  const weight = isFail || isHit || isCrit ? 700 : 400;
                  return (
                    <span key={i} style={{ color, fontWeight: weight, marginRight: 6 }}>{r}</span>
                  );
                })}
              </div>
              {mine && ones > 0 && (
                <button
                  className="small"
                  style={{ marginTop: 4, padding: '2px 8px' }}
                  onClick={() => intents.reroll1s(d.id)}
                >
                  Re-roll {ones} one{ones === 1 ? '' : 's'} ⟳
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
