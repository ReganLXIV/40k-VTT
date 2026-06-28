import { useState } from 'react';
import type { DetachmentInfo } from '@shared/types';
import {
  type DetachmentEdit,
  clearEdit,
  loadEdit,
  saveEdit,
  seedEdit,
} from '../data/detachmentEdits';

// Inline editor for one detachment's 11th-ed content. Saves to localStorage so
// the user's own rules (typed from their faction pack) override everything else.
export default function DetachmentEditor({
  faction,
  name,
  apiInfo,
  onDone,
}: {
  faction?: string;
  name: string;
  apiInfo?: DetachmentInfo;
  onDone: () => void;
}) {
  const [edit, setEdit] = useState<DetachmentEdit>(() => seedEdit(faction, name, apiInfo));
  const hasSaved = !!loadEdit(faction, name);

  const set = (patch: Partial<DetachmentEdit>) => setEdit((e) => ({ ...e, ...patch }));
  const setRule = (k: 'name' | 'effect', v: string) =>
    setEdit((e) => ({ ...e, rule: { name: e.rule?.name ?? '', effect: e.rule?.effect ?? '', [k]: v } }));

  const addStrat = () =>
    set({ stratagems: [...edit.stratagems, { name: '', cp: '1', phase: '', effect: '' }] });
  const setStrat = (i: number, k: string, v: string) =>
    set({ stratagems: edit.stratagems.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
  const delStrat = (i: number) => set({ stratagems: edit.stratagems.filter((_, j) => j !== i) });

  const addEnh = () => set({ enhancements: [...edit.enhancements, { name: '', pts: '', effect: '' }] });
  const setEnh = (i: number, k: string, v: string) =>
    set({ enhancements: edit.enhancements.map((e, j) => (j === i ? { ...e, [k]: v } : e)) });
  const delEnh = (i: number) => set({ enhancements: edit.enhancements.filter((_, j) => j !== i) });

  const save = () => {
    saveEdit(faction, name, edit);
    onDone();
  };
  const revert = () => {
    clearEdit(faction, name);
    onDone();
  };

  const inp = { width: '100%' } as const;

  return (
    <div className="card" style={{ marginTop: 8, background: '#1b1f27' }}>
      <div className="row small" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <strong>Editing {name}</strong>
        <span className="spacer" />
        <label className="small muted">
          DP{' '}
          <input
            type="number"
            min={0}
            max={5}
            style={{ width: 48 }}
            value={edit.dp ?? ''}
            onChange={(e) => set({ dp: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </label>
      </div>

      <h4 style={{ margin: '6px 0 2px' }}>Detachment rule</h4>
      <input
        style={inp}
        placeholder="Rule name"
        value={edit.rule?.name ?? ''}
        onChange={(e) => setRule('name', e.target.value)}
      />
      <textarea
        style={{ ...inp, marginTop: 4 }}
        rows={2}
        placeholder="What the rule does (your own words)"
        value={edit.rule?.effect ?? ''}
        onChange={(e) => setRule('effect', e.target.value)}
      />

      <div className="row" style={{ marginTop: 10 }}>
        <h4 style={{ margin: 0 }}>Enhancements</h4>
        <span className="spacer" />
        <button className="small" onClick={addEnh}>+ add</button>
      </div>
      {edit.enhancements.map((en, i) => (
        <div key={i} className="card" style={{ marginTop: 6 }}>
          <div className="row small" style={{ gap: 6 }}>
            <input style={{ flex: 1 }} placeholder="Name" value={en.name} onChange={(e) => setEnh(i, 'name', e.target.value)} />
            <input style={{ width: 64 }} placeholder="pts" value={en.pts} onChange={(e) => setEnh(i, 'pts', e.target.value)} />
            <button className="small danger" onClick={() => delEnh(i)}>✕</button>
          </div>
          <textarea style={{ ...inp, marginTop: 4 }} rows={2} placeholder="Effect" value={en.effect} onChange={(e) => setEnh(i, 'effect', e.target.value)} />
        </div>
      ))}

      <div className="row" style={{ marginTop: 10 }}>
        <h4 style={{ margin: 0 }}>Stratagems</h4>
        <span className="spacer" />
        <button className="small" onClick={addStrat}>+ add</button>
      </div>
      {edit.stratagems.map((s, i) => (
        <div key={i} className="card" style={{ marginTop: 6 }}>
          <div className="row small" style={{ gap: 6 }}>
            <input style={{ flex: 1 }} placeholder="Name" value={s.name} onChange={(e) => setStrat(i, 'name', e.target.value)} />
            <input style={{ width: 48 }} placeholder="CP" value={s.cp} onChange={(e) => setStrat(i, 'cp', e.target.value)} />
            <button className="small danger" onClick={() => delStrat(i)}>✕</button>
          </div>
          <div className="row small" style={{ gap: 6, marginTop: 4 }}>
            <input style={{ flex: 1 }} placeholder="Turn (e.g. Your turn)" value={s.turn ?? ''} onChange={(e) => setStrat(i, 'turn', e.target.value)} />
            <input style={{ flex: 1 }} placeholder="Phase (e.g. Shooting)" value={s.phase ?? ''} onChange={(e) => setStrat(i, 'phase', e.target.value)} />
          </div>
          <textarea style={{ ...inp, marginTop: 4 }} rows={2} placeholder="Effect" value={s.effect} onChange={(e) => setStrat(i, 'effect', e.target.value)} />
        </div>
      ))}

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <button className="primary" onClick={save}>Save</button>
        <button onClick={onDone}>Cancel</button>
        <span className="spacer" />
        {hasSaved && <button className="danger" onClick={revert}>Reset to default</button>}
      </div>
    </div>
  );
}
