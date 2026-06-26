import { useRef, useState } from 'react';
import type { HydratedRoster } from '@shared/types';
import { SAMPLE_LISTS } from '../data/sampleLists';

export default function ArmyImport({
  onParsed,
}: {
  onParsed: (roster: HydratedRoster) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (raw: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/parse-army', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse failed');
      onParsed(data as HydratedRoster);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const content = await f.text();
    setText(content);
    submit(content);
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Import army (New Recruit)</h3>
      <p className="small muted">
        Paste your New Recruit text export, or upload the .txt file. Stats are matched
        from the datasheet database.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        style={{ width: '100%' }}
        placeholder="Paste New Recruit list here…"
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="primary" disabled={busy || !text.trim()} onClick={() => submit(text)}>
          {busy ? 'Parsing…' : 'Parse & hydrate'}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy}>Upload .txt…</button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          style={{ display: 'none' }}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <select
          value=""
          disabled={busy}
          title="Load a ready-made ~1000pt army"
          onChange={(e) => {
            const s = SAMPLE_LISTS.find((x) => x.id === e.target.value);
            if (s) {
              setText(s.text);
              submit(s.text);
            }
          }}
        >
          <option value="">Load sample list…</option>
          {SAMPLE_LISTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="badge bad" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
