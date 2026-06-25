import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import type {
  Datasheet,
  ModelProfile,
  Weapon,
  Ability,
  DetachmentInfo,
  Stratagem,
  Enhancement,
} from '../shared/types.js';
import { DB_PATH } from './paths.js';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `stats.sqlite not found at ${DB_PATH}. Run "npm run ingest" (with Wahapedia CSVs) or "npm run seed" first.`
    );
  }
  db = new DatabaseSync(DB_PATH, { readOnly: true });
  return db;
}

export function dbExists(): boolean {
  return fs.existsSync(DB_PATH);
}

interface DatasheetRow {
  id: string;
  name: string;
  faction_id: string;
  faction_name: string;
  role: string;
  base_mm: number;
  base_shape: 'circle' | 'oval' | 'rect' | null;
  base_w: number | null;
  base_h: number | null;
  background: string;
}

function rowToDatasheet(row: DatasheetRow): Datasheet {
  const d = getDb();

  const profiles = (
    d
      .prepare(
        'SELECT model_name, m, t, sv, inv_sv, w, ld, oc, base_mm, base_shape, base_w, base_h FROM model_profile WHERE datasheet_id = ? ORDER BY line'
      )
      .all(row.id) as any[]
  ).map(
    (p): ModelProfile => ({
      modelName: p.model_name,
      m: p.m,
      t: p.t,
      sv: p.sv,
      invSv: p.inv_sv ?? '',
      w: p.w,
      ld: p.ld,
      oc: p.oc,
      baseMm: p.base_mm ?? undefined,
      baseShape: p.base_shape ?? undefined,
      baseW: p.base_w ?? undefined,
      baseH: p.base_h ?? undefined,
    })
  );

  const weapons = (
    d
      .prepare(
        'SELECT name, type, range, a, skill, s, ap, d, keywords FROM weapon WHERE datasheet_id = ? ORDER BY line'
      )
      .all(row.id) as any[]
  ).map(
    (w): Weapon => ({
      name: w.name,
      type: w.type,
      range: w.range,
      a: w.a,
      skill: w.skill,
      s: w.s,
      ap: w.ap,
      d: w.d,
      keywords: w.keywords ?? '',
    })
  );

  const abilities = (
    d
      .prepare(
        'SELECT name, description, type, parameter FROM ability WHERE datasheet_id = ? ORDER BY line'
      )
      .all(row.id) as any[]
  ).map(
    (a): Ability => ({
      name: a.name,
      description: a.description,
      type: a.type || undefined,
      parameter: a.parameter || undefined,
    })
  );

  const keywords = (
    d
      .prepare('SELECT keyword FROM keyword WHERE datasheet_id = ?')
      .all(row.id) as any[]
  ).map((k) => k.keyword as string);

  const leads = (
    d
      .prepare('SELECT attached_name FROM leader WHERE datasheet_id = ?')
      .all(row.id) as any[]
  ).map((l) => l.attached_name as string);

  return {
    id: row.id,
    name: row.name,
    factionId: row.faction_id,
    factionName: row.faction_name,
    role: row.role,
    baseMm: row.base_mm,
    baseShape: row.base_shape ?? 'circle',
    baseW: row.base_w ?? row.base_mm,
    baseH: row.base_h ?? row.base_mm,
    background: row.background,
    profiles,
    weapons,
    abilities,
    keywords,
    leads,
  };
}

const SELECT_DATASHEET = `
  SELECT d.id, d.name, d.faction_id, f.name AS faction_name, d.role, d.base_mm, d.base_shape, d.base_w, d.base_h, d.background
  FROM datasheet d
  JOIN faction f ON f.id = d.faction_id
`;

export function getDatasheet(id: string): Datasheet | null {
  const row = getDb()
    .prepare(`${SELECT_DATASHEET} WHERE d.id = ?`)
    .get(id) as DatasheetRow | undefined;
  return row ? rowToDatasheet(row) : null;
}

export function getDatasheetByNorm(
  nameNorm: string,
  factionName?: string
): Datasheet | null {
  let row: DatasheetRow | undefined;
  if (factionName) {
    row = getDb()
      .prepare(
        `${SELECT_DATASHEET} WHERE d.name_norm = ? AND lower(f.name) = lower(?)`
      )
      .get(nameNorm, factionName) as DatasheetRow | undefined;
  }
  if (!row) {
    row = getDb()
      .prepare(`${SELECT_DATASHEET} WHERE d.name_norm = ? LIMIT 1`)
      .get(nameNorm) as DatasheetRow | undefined;
  }
  return row ? rowToDatasheet(row) : null;
}

export interface DatasheetIndexEntry {
  id: string;
  name: string;
  nameNorm: string;
  factionId: string;
  factionName: string;
  baseMm: number;
  role: string;
}

export function allDatasheetIndex(factionName?: string): DatasheetIndexEntry[] {
  let rows: any[];
  if (factionName) {
    rows = getDb()
      .prepare(
        `SELECT d.id, d.name, d.name_norm, d.faction_id, f.name AS faction_name, d.base_mm, d.role
         FROM datasheet d JOIN faction f ON f.id = d.faction_id
         WHERE lower(f.name) = lower(?)
         ORDER BY d.name`
      )
      .all(factionName);
  } else {
    rows = getDb()
      .prepare(
        `SELECT d.id, d.name, d.name_norm, d.faction_id, f.name AS faction_name, d.base_mm, d.role
         FROM datasheet d JOIN faction f ON f.id = d.faction_id
         ORDER BY d.name`
      )
      .all();
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameNorm: r.name_norm,
    factionId: r.faction_id,
    factionName: r.faction_name,
    baseMm: r.base_mm,
    role: r.role,
  }));
}

const normDet = (s: string) =>
  (s || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// Resolve the canonical detachment name stored in the DB from a (possibly messy)
// roster detachment string, scoped to a faction.
function resolveDetachmentName(factionName: string, detachment: string): string | null {
  const want = normDet(detachment);
  if (!want) return null;
  const names = (
    getDb()
      .prepare(
        `SELECT DISTINCT detachment FROM (
           SELECT detachment, faction_name FROM stratagem
           UNION SELECT detachment, faction_name FROM detachment_ability
           UNION SELECT detachment, faction_name FROM enhancement
         ) WHERE lower(faction_name) = lower(?) AND detachment <> ''`
      )
      .all(factionName) as any[]
  ).map((r) => r.detachment as string);

  let best: string | null = null;
  for (const n of names) {
    const nn = normDet(n);
    if (nn === want) return n;
    if (nn && (want.startsWith(nn) || nn.startsWith(want))) best = best ?? n;
  }
  return best;
}

// All detachment names available to a faction (for the manual multi-select).
export function listDetachments(factionName: string): string[] {
  if (!factionName) return [];
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT detachment FROM (
         SELECT detachment, faction_name FROM stratagem
         UNION SELECT detachment, faction_name FROM detachment_ability
         UNION SELECT detachment, faction_name FROM enhancement
       ) WHERE lower(faction_name) = lower(?) AND detachment <> '' ORDER BY detachment`
    )
    .all(factionName) as any[];
  return rows.map((r) => r.detachment as string);
}

export function getDetachmentInfo(
  factionName: string,
  detachment: string
): DetachmentInfo | null {
  if (!factionName || !detachment) return null;
  const det = resolveDetachmentName(factionName, detachment);
  if (!det) return null;
  const d = getDb();

  const abilities = (
    d
      .prepare(
        `SELECT name, description FROM detachment_ability
         WHERE lower(faction_name) = lower(?) AND detachment = ? ORDER BY name`
      )
      .all(factionName, det) as any[]
  ).map((a) => ({ name: a.name, description: a.description }));

  const enhancements = (
    d
      .prepare(
        `SELECT name, cost, description FROM enhancement
         WHERE lower(faction_name) = lower(?) AND detachment = ? ORDER BY name`
      )
      .all(factionName, det) as any[]
  ).map((e): Enhancement => ({ name: e.name, cost: e.cost, description: e.description }));

  const stratagems = (
    d
      .prepare(
        `SELECT name, type, cp_cost, turn, phase, description FROM stratagem
         WHERE lower(faction_name) = lower(?) AND detachment = ? ORDER BY name`
      )
      .all(factionName, det) as any[]
  ).map(
    (s): Stratagem => ({
      name: s.name,
      type: s.type,
      cpCost: s.cp_cost,
      turn: s.turn,
      phase: s.phase,
      description: s.description,
    })
  );

  return { faction: factionName, detachment: det, abilities, enhancements, stratagems };
}
