import { useEffect, useState } from 'react';
import type { Datasheet, HydratedRoster, HydratedUnit } from '@shared/types';
import UnitCard from './UnitCard';

interface DsIndex {
  id: string;
  name: string;
  factionName: string;
  baseMm: number;
}

async function fetchDatasheet(id: string): Promise<Datasheet> {
  const r = await fetch(`/api/datasheet/${id}`);
  if (!r.ok) throw new Error('datasheet fetch failed');
  return r.json();
}

function applyDatasheet(unit: HydratedUnit, ds: Datasheet): HydratedUnit {
  return {
    ...unit,
    datasheetId: ds.id,
    matchConfidence: 1,
    profile: ds.profiles[0],
    altProfiles: ds.profiles.length > 1 ? ds.profiles : undefined,
    weapons: ds.weapons,
    abilities: ds.abilities,
    keywords: ds.keywords,
    leads: ds.leads,
    baseMm: ds.baseMm || unit.baseMm,
    baseShape: ds.baseShape,
    baseW: ds.baseW,
    baseH: ds.baseH,
  };
}

function DatasheetPicker({
  onPick,
}: {
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<DsIndex[]>([]);
  useEffect(() => {
    fetch('/api/datasheets')
      .then((r) => r.json())
      .then(setList)
      .catch(() => setList([]));
  }, []);
  const filtered = list
    .filter((d) => d.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 40);
  return (
    <div className="col" style={{ marginTop: 6 }}>
      <input placeholder="Search datasheets…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ maxHeight: 160, overflowY: 'auto' }}>
        {filtered.map((d) => (
          <div key={d.id} className="row small" style={{ padding: '2px 0' }}>
            <button onClick={() => onPick(d.id)}>{d.name}</button>
            <span className="muted">{d.factionName}</span>
          </div>
        ))}
        {filtered.length === 0 && <div className="small muted">no matches</div>}
      </div>
    </div>
  );
}

export default function RosterList({
  roster,
  onChange,
  onSpawn,
}: {
  roster: HydratedRoster;
  onChange?: (r: HydratedRoster) => void;
  onSpawn?: (unitId: string, asModels: boolean) => void;
}) {
  const [fixing, setFixing] = useState<string | null>(null);

  const overrideUnit = async (unitId: string, dsId: string) => {
    const ds = await fetchDatasheet(dsId);
    const units = roster.units.map((u) => (u.id === unitId ? applyDatasheet(u, ds) : u));
    const unmatchedCount = units.filter((u) => u.datasheetId === null).length;
    onChange?.({ ...roster, units, unmatchedCount });
    setFixing(null);
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <strong>{roster.armyName ?? 'Army'}</strong>
        {roster.faction && <span className="badge">{roster.faction}</span>}
        {roster.detachment && <span className="badge">{roster.detachment}</span>}
        <span className="spacer" />
        {roster.unmatchedCount > 0 && (
          <span className="badge bad">{roster.unmatchedCount} unmatched</span>
        )}
      </div>

      {roster.units.map((u) => (
        <div className="unit-row" key={u.id}>
          <UnitCard unit={u} />
          <div className="row" style={{ marginTop: 6 }}>
            {onChange && (
              <button onClick={() => setFixing(fixing === u.id ? null : u.id)}>
                {u.datasheetId ? 'Change datasheet' : 'Set datasheet'}
              </button>
            )}
            {onSpawn && (
              <button className="primary" onClick={() => onSpawn(u.id, true)}>
                {u.modelCount > 1 ? `Deploy ${u.modelCount} models` : 'Deploy'}
              </button>
            )}
          </div>
          {fixing === u.id && <DatasheetPicker onPick={(id) => overrideUnit(u.id, id)} />}
        </div>
      ))}
    </div>
  );
}
