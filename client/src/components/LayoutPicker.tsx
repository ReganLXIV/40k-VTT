import { useEffect, useState } from 'react';
import type { Layout } from '@shared/types';
import { useGame, intents } from '../state/gameStore';
import LayoutEditor, { blankLayout } from './LayoutEditor';

export default function LayoutPicker() {
  const current = useGame((s) => s.state?.layout);
  const [presets, setPresets] = useState<Layout[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch('/api/layouts').then((r) => r.json()).then(setPresets).catch(() => setPresets([]));
  }, []);

  if (editing && current) {
    return (
      <LayoutEditor
        initial={current}
        onApply={(l) => { intents.setLayout(l); setEditing(false); }}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>Layout</h3>
      <div className="small muted">Current: {current?.name ?? '—'}</div>
      <select
        style={{ width: '100%', marginTop: 6 }}
        value={current?.id ?? ''}
        onChange={(e) => {
          const l = presets.find((p) => p.id === e.target.value);
          if (l) intents.setLayout(l);
        }}
      >
        {(['a', 'b', 'c'] as const).map((letter) => {
          const group = presets.filter((p) => p.id.endsWith(`__${letter}`));
          if (!group.length) return null;
          return (
            <optgroup key={letter} label={`Strike Force — Layout ${letter.toUpperCase()}`}>
              {group.map((p) => (
                <option key={p.id} value={p.id}>{p.name.replace(/\s*—\s*Layout [ABC]$/, '')}</option>
              ))}
            </optgroup>
          );
        })}
        {(() => {
          const other = presets.filter((p) => !/__[abc]$/.test(p.id));
          return other.length ? (
            <optgroup label="Other board sizes">
              {other.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          ) : null;
        })()}
        {current && !presets.find((p) => p.id === current.id) && (
          <option value={current.id}>{current.name} (custom)</option>
        )}
      </select>
      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={() => setEditing(true)}>Edit / New</button>
        <button onClick={() => current && intents.setLayout(blankLayout(current.boardSize))}>Blank board</button>
      </div>
    </div>
  );
}
