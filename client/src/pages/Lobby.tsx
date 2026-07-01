import { useState } from 'react';
import type { HydratedRoster, RoomJoinedPayload } from '@shared/types';
import { socket } from '../socket';
import { useGame, setRoomJoin, intents } from '../state/gameStore';
import ArmyImport from '../components/ArmyImport';
import RosterList from '../components/RosterList';

export default function Lobby() {
  const connected = useGame((s) => s.connected);
  const myRoster = useGame((s) => s.myRoster);
  const setMyRoster = useGame((s) => s.setMyRoster);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const afterJoin = (res: RoomJoinedPayload | { error: string }) => {
    setBusy(false);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setRoomJoin(res.code, res.slot, res.state);
    if (myRoster) intents.setArmy(myRoster);
  };

  const create = () => {
    setBusy(true);
    setError(null);
    socket.emit('room:create', {}, afterJoin);
  };
  const join = (asSpectator = false) => {
    if (!joinCode.trim()) return;
    setBusy(true);
    setError(null);
    socket.emit('room:join', { code: joinCode.trim().toUpperCase(), asSpectator }, afterJoin);
  };

  return (
    <div className="lobby">
      <h1>⚔️ 40K VTT</h1>
      <p className="subtitle">
        Assisted virtual tabletop for 11th-edition Warhammer 40,000. Tracks stats,
        wounds and objectives — combat is resolved manually, just like over a video call.
      </p>
      {!connected && <div className="badge bad">Connecting to server…</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Start a game</h3>
        <div className="row">
          <button className="primary" disabled={!connected || busy} onClick={create}>
            Create room
          </button>
          <span className="muted">or</span>
          <input
            placeholder="ROOM CODE"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={5}
            style={{ textTransform: 'uppercase', width: 120 }}
          />
          <button disabled={!connected || busy || !joinCode.trim()} onClick={() => join(false)}>Join</button>
          <button disabled={!connected || busy || !joinCode.trim()} onClick={() => join(true)} title="Join read-only to watch the game">Watch</button>
        </div>
        {error && <div className="badge bad" style={{ marginTop: 8 }}>{error}</div>}
        <p className="small muted" style={{ marginTop: 8 }}>
          You can import your army now or after joining. Importing now sends it
          automatically when you create/join.
        </p>
      </div>

      <ArmyImport onParsed={setMyRoster} />

      {myRoster && (
        <div className="card">
          <RosterList roster={myRoster} onChange={setMyRoster} />
        </div>
      )}

      <div className="footer-credit">
        11th-edition datasheet data from the{' '}
        <a href="https://github.com/wn-mitch/40kdc-data" target="_blank" rel="noreferrer">
          40kdc-data
        </a>{' '}
        project by Alpaca Software and the 40kdc community contributors, used under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
        . Unofficial fan tool — not affiliated with or endorsed by Games Workshop. No GW
        artwork or rules text is reproduced.
      </div>
    </div>
  );
}
