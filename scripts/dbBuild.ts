import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeName } from '../server/normalize.js';
import type { Ability, ModelProfile, Weapon } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.resolve(__dirname, '../data/stats.sqlite');

export interface DatasheetRecord {
  id: string;
  name: string;
  factionId: string;
  role: string;
  baseMm: number;
  baseShape: 'circle' | 'oval' | 'rect';
  baseW: number;
  baseH: number;
  background: string;
  profiles: ModelProfile[];
  weapons: Weapon[];
  abilities: Ability[];
  keywords: string[];
  leads: string[];
}

export interface FactionRecord {
  id: string;
  name: string;
}

export interface StratagemRecord {
  factionName: string;
  detachment: string;
  name: string;
  type: string;
  cpCost: string;
  turn: string;
  phase: string;
  description: string;
}

export interface DetachmentAbilityRecord {
  factionName: string;
  detachment: string;
  name: string;
  description: string;
}

export interface EnhancementRecord {
  factionName: string;
  detachment: string;
  name: string;
  cost: string;
  description: string;
}

export interface ExtraData {
  stratagems: StratagemRecord[];
  detachmentAbilities: DetachmentAbilityRecord[];
  enhancements: EnhancementRecord[];
}

const SCHEMA = `
DROP TABLE IF EXISTS faction;
DROP TABLE IF EXISTS datasheet;
DROP TABLE IF EXISTS model_profile;
DROP TABLE IF EXISTS weapon;
DROP TABLE IF EXISTS ability;
DROP TABLE IF EXISTS keyword;
DROP TABLE IF EXISTS leader;
DROP TABLE IF EXISTS stratagem;
DROP TABLE IF EXISTS detachment_ability;
DROP TABLE IF EXISTS enhancement;

CREATE TABLE faction (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE datasheet (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  name_norm  TEXT NOT NULL,
  faction_id TEXT NOT NULL REFERENCES faction(id),
  role       TEXT,
  base_mm    INTEGER,
  base_shape TEXT,
  base_w     REAL,
  base_h     REAL,
  background TEXT
);
CREATE INDEX idx_datasheet_namenorm ON datasheet(name_norm);
CREATE INDEX idx_datasheet_faction  ON datasheet(faction_id);

CREATE TABLE model_profile (
  datasheet_id TEXT REFERENCES datasheet(id),
  line         INTEGER,
  model_name   TEXT,
  m  INTEGER, t INTEGER, sv TEXT, inv_sv TEXT,
  w  INTEGER, ld TEXT, oc INTEGER,
  base_mm INTEGER,
  base_shape TEXT, base_w REAL, base_h REAL,
  PRIMARY KEY (datasheet_id, line)
);

CREATE TABLE weapon (
  datasheet_id TEXT REFERENCES datasheet(id),
  line         INTEGER,
  name         TEXT,
  type         TEXT,
  range        TEXT,
  a    TEXT, skill TEXT,
  s    TEXT, ap TEXT, d TEXT,
  keywords TEXT,
  PRIMARY KEY (datasheet_id, line)
);

CREATE TABLE ability (
  datasheet_id TEXT REFERENCES datasheet(id),
  line         INTEGER,
  name         TEXT,
  description  TEXT,
  type         TEXT,
  parameter    TEXT,
  PRIMARY KEY (datasheet_id, line)
);

CREATE TABLE keyword (
  datasheet_id TEXT REFERENCES datasheet(id),
  keyword      TEXT
);

CREATE TABLE leader (
  datasheet_id  TEXT REFERENCES datasheet(id),
  attached_name TEXT
);

CREATE TABLE stratagem (
  faction_name TEXT,
  detachment   TEXT,
  name         TEXT,
  type         TEXT,
  cp_cost      TEXT,
  turn         TEXT,
  phase        TEXT,
  description  TEXT
);
CREATE INDEX idx_strat_det ON stratagem(detachment);

CREATE TABLE detachment_ability (
  faction_name TEXT,
  detachment   TEXT,
  name         TEXT,
  description  TEXT
);
CREATE INDEX idx_detab_det ON detachment_ability(detachment);

CREATE TABLE enhancement (
  faction_name TEXT,
  detachment   TEXT,
  name         TEXT,
  cost         TEXT,
  description  TEXT
);
CREATE INDEX idx_enh_det ON enhancement(detachment);
`;

export function buildDatabase(
  factions: FactionRecord[],
  datasheets: DatasheetRecord[],
  extra?: ExtraData
): void {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA);

  const insFaction = db.prepare('INSERT OR REPLACE INTO faction (id, name) VALUES (?, ?)');
  const insDatasheet = db.prepare(
    `INSERT OR REPLACE INTO datasheet (id, name, name_norm, faction_id, role, base_mm, base_shape, base_w, base_h, background)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insProfile = db.prepare(
    `INSERT OR REPLACE INTO model_profile (datasheet_id, line, model_name, m, t, sv, inv_sv, w, ld, oc, base_mm, base_shape, base_w, base_h)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insWeapon = db.prepare(
    `INSERT OR REPLACE INTO weapon (datasheet_id, line, name, type, range, a, skill, s, ap, d, keywords)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insAbility = db.prepare(
    `INSERT OR REPLACE INTO ability (datasheet_id, line, name, description, type, parameter)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insKeyword = db.prepare(
    'INSERT INTO keyword (datasheet_id, keyword) VALUES (?, ?)'
  );
  const insLeader = db.prepare(
    'INSERT INTO leader (datasheet_id, attached_name) VALUES (?, ?)'
  );
  const insStratagem = db.prepare(
    `INSERT INTO stratagem (faction_name, detachment, name, type, cp_cost, turn, phase, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insDetAbility = db.prepare(
    'INSERT INTO detachment_ability (faction_name, detachment, name, description) VALUES (?, ?, ?, ?)'
  );
  const insEnhancement = db.prepare(
    'INSERT INTO enhancement (faction_name, detachment, name, cost, description) VALUES (?, ?, ?, ?, ?)'
  );

  db.exec('BEGIN');
  try {
    for (const f of factions) insFaction.run(f.id, f.name);

    for (const d of datasheets) {
      insDatasheet.run(
        d.id,
        d.name,
        normalizeName(d.name),
        d.factionId,
        d.role,
        d.baseMm,
        d.baseShape,
        d.baseW,
        d.baseH,
        d.background
      );
      d.profiles.forEach((p, i) =>
        insProfile.run(
          d.id, i, p.modelName, p.m, p.t, p.sv, p.invSv, p.w, p.ld, p.oc,
          p.baseMm ?? null, p.baseShape ?? null, p.baseW ?? null, p.baseH ?? null
        )
      );
      d.weapons.forEach((w, i) =>
        insWeapon.run(d.id, i, w.name, w.type, w.range, w.a, w.skill, w.s, w.ap, w.d, w.keywords)
      );
      d.abilities.forEach((a, i) =>
        insAbility.run(d.id, i, a.name, a.description, a.type ?? '', a.parameter ?? '')
      );
      for (const k of d.keywords) insKeyword.run(d.id, k);
      for (const name of d.leads) insLeader.run(d.id, name);
    }

    if (extra) {
      for (const s of extra.stratagems)
        insStratagem.run(s.factionName, s.detachment, s.name, s.type, s.cpCost, s.turn, s.phase, s.description);
      for (const a of extra.detachmentAbilities)
        insDetAbility.run(a.factionName, a.detachment, a.name, a.description);
      for (const e of extra.enhancements)
        insEnhancement.run(e.factionName, e.detachment, e.name, e.cost, e.description);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  // quality summary
  const perFaction = db
    .prepare(
      `SELECT f.name AS name, COUNT(*) AS n FROM datasheet d JOIN faction f ON f.id = d.faction_id GROUP BY f.name ORDER BY f.name`
    )
    .all() as any[];
  console.log('\n[build] datasheets per faction:');
  for (const r of perFaction) console.log(`  ${r.name}: ${r.n}`);

  const noProfiles = db
    .prepare(
      `SELECT d.name FROM datasheet d LEFT JOIN model_profile p ON p.datasheet_id = d.id WHERE p.datasheet_id IS NULL`
    )
    .all() as any[];
  const noWeapons = db
    .prepare(
      `SELECT d.name FROM datasheet d LEFT JOIN weapon w ON w.datasheet_id = d.id WHERE w.datasheet_id IS NULL`
    )
    .all() as any[];
  if (noProfiles.length)
    console.warn(`[build] WARNING ${noProfiles.length} datasheets with no model profile`);
  if (noWeapons.length)
    console.warn(`[build] WARNING ${noWeapons.length} datasheets with no weapons`);

  db.close();
  console.log(`\n[build] wrote ${DB_PATH}`);
}
