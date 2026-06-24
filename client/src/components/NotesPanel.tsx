import { useEffect, useRef, useState } from 'react';
import { useGame, intents } from '../state/gameStore';

// Private per-player scratchpad for secondaries / reminders. Synced (so it
// survives reconnects) but only your own notes are shown.
export default function NotesPanel() {
  const slot = useGame((s) => s.slot);
  const serverNotes = useGame((s) =>
    slot && slot !== 'spectator' ? s.state?.notes?.[slot] ?? '' : ''
  );
  const [text, setText] = useState(serverNotes);
  const inited = useRef(false);

  useEffect(() => {
    if (!inited.current && serverNotes) {
      setText(serverNotes);
      inited.current = true;
    }
  }, [serverNotes]);

  if (!slot || slot === 'spectator') return null;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Secondaries / notes</h3>
      <textarea
        rows={5}
        style={{ width: '100%' }}
        value={text}
        placeholder="Track secondary missions, CP, reminders… (private to you)"
        onChange={(e) => {
          setText(e.target.value);
          intents.setNotes(e.target.value);
        }}
      />
    </div>
  );
}
