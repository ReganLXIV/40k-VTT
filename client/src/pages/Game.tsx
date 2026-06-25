import { useState } from 'react';
import type { HydratedRoster, Token } from '@shared/types';
import { useGame, leaveRoom, intents } from '../state/gameStore';
import BoardCanvas from '../board/BoardCanvas';
import DicePanel from '../components/DicePanel';
import NotesPanel from '../components/NotesPanel';
import GameTrack from '../components/GameTrack';
import LayoutPicker from '../components/LayoutPicker';
import RosterList from '../components/RosterList';
import UnitCard from '../components/UnitCard';
import ArmyImport from '../components/ArmyImport';
import DetachmentPanel from '../components/DetachmentPanel';
import MissionsPanel from '../components/MissionsPanel';

export default function Game() {
  const state = useGame((s) => s.state)!;
  const slot = useGame((s) => s.slot);
  const code = useGame((s) => s.code);
  const tool = useGame((s) => s.tool);
  const setTool = useGame((s) => s.setTool);
  const showGrid = useGame((s) => s.showGrid);
  const toggleGrid = useGame((s) => s.toggleGrid);
  const showRanges = useGame((s) => s.showRanges);
  const toggleRanges = useGame((s) => s.toggleRanges);
  const showNoDeploy = useGame((s) => s.showNoDeploy);
  const noDeployRadius = useGame((s) => s.noDeployRadius);
  const toggleNoDeploy = useGame((s) => s.toggleNoDeploy);
  const setNoDeployRadius = useGame((s) => s.setNoDeployRadius);
  const renderError = useGame((s) => s.renderError);
  const selectedTokenId = useGame((s) => s.selectedTokenId);
  const selectedIds = useGame((s) => s.selectedIds);
  const [showImport, setShowImport] = useState(false);
  const [showDetachment, setShowDetachment] = useState(false);
  const [showMissions, setShowMissions] = useState(false);

  const mySlot = slot === 'spectator' ? null : slot;
  const myRoster: HydratedRoster | undefined =
    mySlot ? state.players[mySlot]?.roster : undefined;

  const oppSlot = mySlot === 'player1' ? 'player2' : 'player1';
  const oppRoster = state.players[oppSlot as 'player1' | 'player2']?.roster;

  const selectedToken = state.tokens.find((t) => t.id === selectedTokenId);
  const selectedUnit =
    selectedToken && myRoster
      ? myRoster.units.find((u) => u.datasheetId === selectedToken.datasheetId)
      : undefined;

  // Reanimate n models: multi-model token → bump models + wounds; single-model
  // token (e.g. a deployed Necron Warrior) → clone n fresh models.
  const reanimate = (t: Token, n: number) => {
    if (t.modelsMax > 1) {
      const perModel = Math.max(1, Math.round(t.woundsMax / t.modelsMax));
      intents.update(t.id, {
        modelsCurrent: Math.min(t.modelsMax, t.modelsCurrent + n),
        woundsCurrent: Math.min(t.woundsMax, t.woundsCurrent + n * perModel),
      });
    } else {
      intents.clone(t.id, n);
    }
  };

  const setArmy = (r: HydratedRoster) => {
    intents.setArmy(r);
    setShowImport(false);
  };

  const p1conn = state.players.player1?.connected;
  const p2conn = state.players.player2?.connected;

  return (
    <div className="game">
      {renderError && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
            background: '#7f1d1d', color: '#fff', padding: '6px 12px',
            font: '12px system-ui', display: 'flex', gap: 10, alignItems: 'center',
          }}
        >
          <strong>Board render error:</strong>
          <span style={{ flex: 1, fontFamily: 'monospace' }}>{renderError}</span>
          <span className="muted" style={{ color: '#fecaca' }}>
            (the board keeps running — please screenshot this)
          </span>
          <button onClick={() => useGame.setState({ renderError: null })}>Dismiss</button>
        </div>
      )}
      <div className="topbar">
        <strong>Room {code}</strong>
        <span className={`badge ${mySlot === 'player1' ? 'p1' : mySlot === 'player2' ? 'p2' : ''}`}>
          You: {slot}
        </span>
        <span className={`badge ${p1conn ? 'good' : 'bad'}`}>P1 {p1conn ? '●' : '○'}</span>
        <span className={`badge ${p2conn ? 'good' : 'bad'}`}>P2 {p2conn ? '●' : '○'}</span>
        <span className="spacer" />
        <span className="small muted">
          Round {state.turn} · {state.phase} · {state.activePlayer === 'player1' ? 'P1' : 'P2'}
        </span>
        <button onClick={() => setShowDetachment(true)} disabled={!myRoster?.faction}>
          Detachments
        </button>
        <button onClick={() => setShowMissions(true)}>Missions</button>
        <button className={`toolbtn ${tool === 'select' ? 'active' : ''}`} onClick={() => setTool('select')}>Select</button>
        <button className={`toolbtn ${tool === 'ruler' ? 'active' : ''}`} onClick={() => setTool('ruler')}>Ruler</button>
        <button className={`toolbtn ${tool === 'ping' ? 'active' : ''}`} onClick={() => setTool('ping')} title="Click the board to ping your opponent (or Alt+click any time)">Ping</button>
        <button className={`toolbtn ${tool === 'pan' ? 'active' : ''}`} onClick={() => setTool('pan')} title="Drag to pan; scroll wheel zooms anytime">Pan</button>
        <button className={`toolbtn ${showGrid ? 'active' : ''}`} onClick={toggleGrid}>Grid</button>
        <button className={`toolbtn ${showRanges ? 'active' : ''}`} onClick={toggleRanges} title="Show Move + weapon range rings around the selected unit">Ranges</button>
        <button className="danger" onClick={leaveRoom}>Leave</button>
      </div>

      <div className="left-panel">
        <LayoutPicker />
        <div className="card">
          <div className="row">
            <h3 style={{ margin: 0 }}>Your army</h3>
            <span className="spacer" />
            <button onClick={() => setShowImport((s) => !s)}>{myRoster ? 'Re-import' : 'Import'}</button>
          </div>
          {showImport && <div style={{ marginTop: 8 }}><ArmyImport onParsed={setArmy} /></div>}
          {myRoster ? (
            <div style={{ marginTop: 8 }}>
              <div className="row" style={{ marginBottom: 8 }}>
                <button className="primary" onClick={() => intents.deployAll()} title="Spawn every unit not yet on the table into your deployment zone">
                  Deploy all
                </button>
                <button className="danger" onClick={() => intents.clearMyTokens()}>Clear my tokens</button>
              </div>
              <RosterList
                roster={myRoster}
                onChange={setArmy}
                onSpawn={(unitId, asModels) => intents.spawn(unitId, asModels)}
              />
            </div>
          ) : (
            !showImport && <p className="small muted">No army imported yet.</p>
          )}
        </div>
      </div>

      <BoardCanvas />

      <div className="right-panel">
        <GameTrack />
        <DicePanel />
        <NotesPanel />

        {selectedIds.length > 1 && (
          <div className="card small muted">
            {selectedIds.length} models selected · Delete removes all · drag one to move the block
          </div>
        )}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Selected</h3>
          {selectedToken ? (
            <>
              <div className="row">
                <strong>{selectedToken.label}</strong>
                <span className={`badge ${selectedToken.owner === 'player1' ? 'p1' : 'p2'}`}>
                  {selectedToken.owner}
                </span>
              </div>
              <div className="small muted" style={{ margin: '4px 0' }}>
                Wounds {selectedToken.woundsCurrent}/{selectedToken.woundsMax}
                {selectedToken.modelsMax > 1 && ` · Models ${selectedToken.modelsCurrent}/${selectedToken.modelsMax}`}
              </div>
              <div className="row">
                <button onClick={() => intents.update(selectedToken.id, { woundsCurrent: Math.max(0, selectedToken.woundsCurrent - 1) })}>−1 W</button>
                <button onClick={() => intents.update(selectedToken.id, { woundsCurrent: Math.min(selectedToken.woundsMax, selectedToken.woundsCurrent + 1) })}>+1 W</button>
                {selectedToken.modelsMax > 1 && (
                  <button onClick={() => intents.update(selectedToken.id, { modelsCurrent: Math.max(0, selectedToken.modelsCurrent - 1) })}>−1 model</button>
                )}
                <button title="Reanimate: add a model back (Reanimation Protocols, etc.)" onClick={() => reanimate(selectedToken, 1)}>
                  Reanimate +1 ⟳
                </button>
                <button
                  title="Reanimate a number of models back (e.g. D3)"
                  onClick={() => {
                    const v = prompt('Reanimate how many models?', '1');
                    const n = Math.max(0, Math.floor(Number(v) || 0));
                    if (n) reanimate(selectedToken, n);
                  }}
                >
                  Reanimate N…
                </button>
              </div>
              <div className="row" style={{ marginTop: 6, gap: 4, flexWrap: 'wrap' }}>
                {['Battle-shocked', 'Below Half', 'Fell Back', 'Advanced'].map((s) => {
                  const on = selectedToken.status.includes(s);
                  return (
                    <button
                      key={s}
                      className={`toolbtn ${on ? 'active' : ''}`}
                      style={{ fontSize: 11, padding: '2px 6px' }}
                      onClick={() =>
                        intents.update(selectedToken.id, {
                          status: on
                            ? selectedToken.status.filter((x) => x !== s)
                            : [...selectedToken.status, s],
                        })
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              {selectedUnit?.weapons && selectedUnit.weapons.length > 0 && (
                <div className="row small" style={{ marginTop: 6 }}>
                  <span className="muted">Special weapon</span>
                  <select
                    value={selectedToken.weapon ?? ''}
                    onChange={(e) => intents.update(selectedToken.id, { weapon: e.target.value })}
                  >
                    <option value="">— none —</option>
                    {selectedUnit.weapons.map((w, i) => (
                      <option key={i} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {(() => {
                const shape = selectedToken.baseShape ?? 'circle';
                const dia = Math.round(selectedToken.baseMm || 32);
                const w = Math.round(selectedToken.baseW ?? selectedToken.baseMm ?? 32);
                const h = Math.round(selectedToken.baseH ?? selectedToken.baseMm ?? 32);
                const setShape = (s: 'circle' | 'oval' | 'rect') => {
                  if (s === 'circle') intents.update(selectedToken.id, { baseShape: 'circle', baseW: dia, baseH: dia, baseMm: dia });
                  else intents.update(selectedToken.id, { baseShape: s, baseW: w, baseH: h, baseMm: Math.max(w, h) });
                };
                const num = (v: string, fallback: number) => { const n = Math.round(Number(v)); return n > 0 ? n : fallback; };
                return (
                  <div style={{ marginTop: 8, borderTop: '1px solid #2a2a2a', paddingTop: 6 }}>
                    <div className="row small" style={{ gap: 6, alignItems: 'center' }}>
                      <span className="muted">Base</span>
                      {(['circle', 'oval', 'rect'] as const).map((s) => (
                        <button
                          key={s}
                          className={`toolbtn ${shape === s ? 'active' : ''}`}
                          style={{ fontSize: 11, padding: '2px 6px' }}
                          onClick={() => setShape(s)}
                        >
                          {s === 'rect' ? 'hull' : s}
                        </button>
                      ))}
                    </div>
                    <div className="row small" style={{ gap: 6, marginTop: 4, alignItems: 'center' }}>
                      {shape === 'circle' ? (
                        <>
                          <span className="muted">⌀ mm</span>
                          <input type="number" min={10} max={400} value={dia} style={{ width: 64 }}
                            onChange={(e) => { const d = num(e.target.value, dia); intents.update(selectedToken.id, { baseMm: d, baseW: d, baseH: d }); }} />
                          <span className="muted">({(dia / 25.4).toFixed(1)}″)</span>
                        </>
                      ) : (
                        <>
                          <span className="muted">W</span>
                          <input type="number" min={10} max={500} value={w} style={{ width: 60 }}
                            onChange={(e) => { const nw = num(e.target.value, w); intents.update(selectedToken.id, { baseW: nw, baseMm: Math.max(nw, h) }); }} />
                          <span className="muted">× L</span>
                          <input type="number" min={10} max={500} value={h} style={{ width: 60 }}
                            onChange={(e) => { const nh = num(e.target.value, h); intents.update(selectedToken.id, { baseH: nh, baseMm: Math.max(w, nh) }); }} />
                          <span className="muted">mm ({(w / 25.4).toFixed(1)}×{(h / 25.4).toFixed(1)}″)</span>
                        </>
                      )}
                    </div>
                    {shape !== 'circle' && (
                      <div className="row small" style={{ marginTop: 4, gap: 6, alignItems: 'center' }}>
                        <span className="muted">Rotate</span>
                        <input type="range" min={0} max={345} step={15} value={selectedToken.rotation ?? 0}
                          onChange={(e) => intents.update(selectedToken.id, { rotation: +e.target.value })}
                          style={{ flex: 1 }} />
                        <span style={{ width: 34, textAlign: 'right' }}>{selectedToken.rotation ?? 0}°</span>
                      </div>
                    )}
                  </div>
                );
              })()}
              {selectedUnit && <div style={{ marginTop: 10 }}><UnitCard unit={selectedUnit} /></div>}
            </>
          ) : (
            <p className="small muted">Click a token to see its datasheet. Right-click for quick actions.</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Objectives</h3>
          <div className="row small" style={{ gap: 6, marginBottom: 6 }}>
            <button
              onClick={() => intents.autoObjectives()}
              title="Colour each objective by who holds it, from model OC (a model counts if its base touches the objective ring). Does not change scores."
            >
              Auto-colour control
            </button>
          </div>
          <div className="row small" style={{ gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <button
              className={`toolbtn ${showNoDeploy ? 'active' : ''}`}
              onClick={toggleNoDeploy}
              title="Show the no-deployment radius around the central objective(s)"
            >
              No-deploy radius
            </button>
            <input
              type="number"
              min={0}
              max={24}
              value={noDeployRadius}
              onChange={(e) => setNoDeployRadius(+e.target.value)}
              style={{ width: 48 }}
            />
            <span className="muted">″ around centre</span>
          </div>
          {state.layout.objectives.map((o) => (
            <div className="row small" key={o.id} style={{ padding: '3px 0' }}>
              <span>{o.type}</span>
              <span className="spacer" />
              {(['player1', 'player2', null] as const).map((p) => (
                <button
                  key={String(p)}
                  className={`toolbtn ${state.objectives[o.id] === p ? 'active' : ''}`}
                  onClick={() => intents.objective(o.id, p)}
                >
                  {p === null ? 'none' : p === 'player1' ? 'P1' : 'P2'}
                </button>
              ))}
            </div>
          ))}
        </div>

        {oppRoster && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Opponent army</h3>
            <RosterList roster={oppRoster} />
          </div>
        )}
      </div>

      {showDetachment && (
        <DetachmentPanel
          faction={myRoster?.faction}
          detachments={myRoster?.detachments ?? (myRoster?.detachment ? [myRoster.detachment] : [])}
          points={myRoster?.declaredPoints}
          onClose={() => setShowDetachment(false)}
        />
      )}
      {showMissions && <MissionsPanel onClose={() => setShowMissions(false)} />}
    </div>
  );
}
