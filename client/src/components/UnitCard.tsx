import type { Ability, HydratedUnit, ModelProfile, Weapon } from '@shared/types';

// Universal, well-known abilities: show as a compact tag, not a paragraph.
const TAG_TYPES = new Set(['core', 'faction']);

function abilityLabel(a: Ability): string {
  return a.parameter ? `${a.name} ${a.parameter}` : a.name;
}

function AbilitiesBlock({ unit }: { unit: HydratedUnit }) {
  const abilities = unit.abilities ?? [];
  const leads = unit.leads ?? [];

  // Tags: core/faction abilities, minus "Leader" (shown as its own line below).
  const tags = abilities.filter(
    (a) => TAG_TYPES.has((a.type ?? '').toLowerCase()) && a.name.toLowerCase() !== 'leader'
  );
  const detailed = abilities.filter((a) => !TAG_TYPES.has((a.type ?? '').toLowerCase()));
  const hasLeader = abilities.some((a) => a.name.toLowerCase() === 'leader') || leads.length > 0;

  if (!abilities.length && !leads.length) return null;

  return (
    <div style={{ marginTop: 6 }}>
      {hasLeader && (
        <div className="small" style={{ marginBottom: 4 }}>
          <span className="badge p1">Leader</span>{' '}
          {leads.length > 0 ? (
            <>can lead: {leads.join(', ')}</>
          ) : (
            <span className="muted">see bodyguard list</span>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: detailed.length ? 6 : 0 }}>
          {tags.map((a, i) => (
            <span className="badge" key={i} title={a.description}>{abilityLabel(a)}</span>
          ))}
        </div>
      )}

      {detailed.length > 0 && (
        <>
          <div className="small muted">Abilities</div>
          {detailed.map((a, i) => (
            <div key={i} className="small">
              <strong>{abilityLabel(a)}.</strong>{' '}
              {a.textEdition === '10e' && a.description && (
                <span
                  className="badge"
                  style={{ fontSize: 9, padding: '0 3px', marginRight: 4, opacity: 0.7 }}
                  title="Effect text is 10th-edition wording (from the Wahapedia import) and may have changed in 11th"
                >
                  10e
                </span>
              )}
              {a.description}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StatLine({ p }: { p: ModelProfile }) {
  return (
    <div>
      <div className="small muted" style={{ marginTop: 4 }}>{p.modelName}</div>
      <div className="statline">
        {['M', 'T', 'SV', 'W', 'LD', 'OC', 'INV'].map((h) => (
          <div className="h" key={h}>{h}</div>
        ))}
        <div className="v">{p.m}"</div>
        <div className="v">{p.t}</div>
        <div className="v">{p.sv}</div>
        <div className="v">{p.w}</div>
        <div className="v">{p.ld}</div>
        <div className="v">{p.oc}</div>
        <div className="v">{p.invSv || '—'}</div>
      </div>
    </div>
  );
}

function WeaponTable({ weapons }: { weapons: Weapon[] }) {
  if (!weapons.length) return null;
  const ranged = weapons.filter((w) => w.type === 'ranged');
  const melee = weapons.filter((w) => w.type === 'melee');
  return (
    <>
      {ranged.length > 0 && <WGroup title="Ranged" rows={ranged} skillH="BS" />}
      {melee.length > 0 && <WGroup title="Melee" rows={melee} skillH="WS" />}
    </>
  );
}

function WGroup({ title, rows, skillH }: { title: string; rows: Weapon[]; skillH: string }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div className="small muted">{title}</div>
      <table className="weapons">
        <thead>
          <tr>
            <th>Weapon</th><th>Rng</th><th>A</th><th>{skillH}</th><th>S</th><th>AP</th><th>D</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w, i) => (
            <tr key={i}>
              <td title={w.keywords}>{w.name}{w.keywords ? ' ✦' : ''}</td>
              <td>{w.range}</td><td>{w.a}</td><td>{w.skill}</td><td>{w.s}</td><td>{w.ap}</td><td>{w.d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UnitCard({ unit }: { unit: HydratedUnit }) {
  const profiles = unit.altProfiles ?? (unit.profile ? [unit.profile] : []);
  return (
    <div>
      <div className="row">
        <h4 style={{ margin: 0 }}>{unit.rawName}</h4>
        <span className="spacer" />
        <span className="small muted">{unit.points} pts · {unit.modelCount} model{unit.modelCount > 1 ? 's' : ''}</span>
      </div>
      {unit.datasheetId === null ? (
        <div className="badge bad" style={{ marginTop: 6 }}>stats unavailable — set datasheet manually</div>
      ) : unit.matchConfidence < 1 ? (
        <div className="badge warn" style={{ marginTop: 6 }}>
          fuzzy match ({Math.round(unit.matchConfidence * 100)}%) — verify
        </div>
      ) : null}

      {profiles.map((p, i) => <StatLine key={i} p={p} />)}
      {unit.weapons && <WeaponTable weapons={unit.weapons} />}

      <AbilitiesBlock unit={unit} />

      {unit.keywords && unit.keywords.length > 0 && (
        <div className="small muted" style={{ marginTop: 6 }}>
          Keywords: {unit.keywords.join(', ')}
        </div>
      )}

      {unit.wargear.length > 0 && (
        <div className="small muted" style={{ marginTop: 4 }}>Wargear: {unit.wargear.join('; ')}</div>
      )}
      {unit.enhancements.length > 0 && (
        <div className="small" style={{ marginTop: 4 }}>
          <span className="badge p1">Enhancement</span> {unit.enhancements.join('; ')}
        </div>
      )}
    </div>
  );
}
