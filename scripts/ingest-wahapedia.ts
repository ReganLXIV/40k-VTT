/**
 * Builds data/stats.sqlite from a Wahapedia CSV export.
 *
 * 1. Download the Wahapedia CSV export (semicolon-delimited files) into
 *    data/wahapedia/ . See README "Getting the datasheet data".
 * 2. Run:  npm run ingest
 *
 * The script is column-name driven and defensive: it maps fields by header name,
 * so it tolerates minor column-order drift in the export.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import {
  buildDatabase,
  type DatasheetRecord,
  type DetachmentAbilityRecord,
  type EnhancementRecord,
  type FactionRecord,
  type StratagemRecord,
} from './dbBuild.js';
import type { Ability, ModelProfile, Weapon } from '../shared/types.js';
import { hullRect } from './hullSizes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_DIR = path.resolve(__dirname, '../data/wahapedia');

// Default ingest is ALL factions. Set INGEST_XENOS_ONLY=1 to restrict to this
// Xenos subset (match by name, case-insensitive).
const XENOS = new Set(
  [
    'Aeldari',
    'Drukhari',
    'Genestealer Cults',
    'Leagues of Votann',
    'Necrons',
    'Orks',
    "T'au Empire",
    'Tyranids',
  ].map((s) => s.toLowerCase())
);

function readCsv(file: string): Record<string, string>[] {
  const full = path.join(CSV_DIR, file);
  if (!fs.existsSync(full)) {
    console.warn(`[ingest] missing ${file} — skipping`);
    return [];
  }
  const text = fs.readFileSync(full, 'utf-8').replace(/^﻿/, '');
  // Per the Wahapedia "Export Data Specs": files are "|" (vertical bar) delimited,
  // UTF-8, and rows often carry a trailing delimiter.
  return parse(text, {
    delimiter: '|',
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  });
}

// description / legend / ability fields are HTML; flatten to readable plain text.
function stripHtml(s: string): string {
  if (!s) return '';
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#?\w+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pick a value by trying several candidate column names (case-insensitive).
function pick(row: Record<string, string>, ...keys: string[]): string {
  const lower: Record<string, string> = {};
  for (const k of Object.keys(row)) lower[k.toLowerCase()] = row[k];
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== '') return v;
  }
  return '';
}

function num(s: string, fallback = 0): number {
  const m = s.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : fallback;
}

// Hull-footprint vehicles (no official base, or a big model on a small flying
// stem) are measured from the hull — see scripts/hullSizes.ts for the table.
type BaseInfo = { shape: 'circle' | 'oval' | 'rect'; w: number; h: number; mm: number };
function parseBase(s: string, name: string, wounds: number): BaseInfo {
  const t = (s || '').toLowerCase();
  const oval = t.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/); // "120 x 92mm [flying base]"
  const useModel = t === '' || /use model|no official/.test(t);
  // a small round flying stem ("60mm flying base") under a big model → hull
  const smallFlyingBig = /flying/.test(t) && !oval && wounds >= 9;

  if (useModel || smallFlyingBig) {
    const [w, h] = hullRect(name, wounds);
    return { shape: 'rect', w, h, mm: Math.max(w, h) };
  }
  // a large flying base ("120 x 92mm flying base") IS the footprint → oval
  if (oval) {
    const w = parseFloat(oval[1]), h = parseFloat(oval[2]);
    return { shape: 'oval', w, h, mm: Math.max(w, h) };
  }
  const circ = t.match(/(\d+(?:\.\d+)?)\s*mm/);
  if (circ) {
    const d = parseFloat(circ[1]);
    return { shape: 'circle', w: d, h: d, mm: d };
  }
  const [w, h] = hullRect(name, wounds);
  return { shape: 'rect', w, h, mm: Math.max(w, h) };
}

function main() {
  if (!fs.existsSync(CSV_DIR)) {
    console.error(
      `[ingest] No CSV directory at ${CSV_DIR}.\n` +
        `Download the Wahapedia CSV export into data/wahapedia/ first (see README).`
    );
    process.exit(1);
  }

  // tolerate apostrophe / spacing variants (e.g. "T'au Empire" vs "T’au Empire")
  const factionKey = (s: string) =>
    s.toLowerCase().replace(/['’`]/g, '').replace(/\s+/g, ' ').trim();
  const wantedKeys = new Set([...XENOS].map(factionKey));
  // INGEST_XENOS_ONLY=1 keeps the old Xenos-only behaviour; default is ALL factions.
  const xenosOnly = process.env.INGEST_XENOS_ONLY === '1';

  const factionRows = readCsv('Factions.csv');
  const wantedFactions = new Map<string, FactionRecord>();
  for (const r of factionRows) {
    const id = pick(r, 'id');
    const name = pick(r, 'name');
    if (!id || !name) continue;
    if (!xenosOnly || wantedKeys.has(factionKey(name))) {
      wantedFactions.set(id, { id, name });
    }
  }
  if (wantedFactions.size === 0) {
    console.error('[ingest] No factions found in Factions.csv — aborting.');
    process.exit(1);
  }

  const dsRows = readCsv('Datasheets.csv');
  const modelRows = readCsv('Datasheets_models.csv');
  const wargearRows = readCsv('Datasheets_wargear.csv');
  const abilityRows = readCsv('Datasheets_abilities.csv');
  const keywordRows = readCsv('Datasheets_keywords.csv');

  // Abilities.csv is the master ability table; Datasheets_abilities rows may carry
  // only an ability_id and rely on this for name/description.
  const abilityLookup = new Map<string, { name: string; description: string }>();
  for (const r of readCsv('Abilities.csv')) {
    const aid = pick(r, 'id');
    if (aid) {
      abilityLookup.set(aid, {
        name: pick(r, 'name'),
        description: pick(r, 'description'),
      });
    }
  }

  // group child rows by datasheet_id
  const byDs = <T>(rows: Record<string, string>[], fn: (r: Record<string, string>) => T) => {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const id = pick(r, 'datasheet_id');
      if (!id) continue;
      (map.get(id) ?? map.set(id, []).get(id)!).push(fn(r));
    }
    return map;
  };

  const keywordsByDs = new Map<string, string[]>();
  for (const r of keywordRows) {
    const id = pick(r, 'datasheet_id');
    const kw = pick(r, 'keyword');
    if (!id || !kw) continue;
    (keywordsByDs.get(id) ?? keywordsByDs.set(id, []).get(id)!).push(kw);
  }

  const profilesByDs = byDs<ModelProfile>(modelRows, (r) => {
    const name = pick(r, 'name', 'model_name') || 'Model';
    const w = num(pick(r, 'W', 'w'), 1);
    const base = parseBase(pick(r, 'base_size', 'base_size_descr'), name, w);
    return {
      modelName: name,
      m: num(pick(r, 'M', 'm')),
      t: num(pick(r, 'T', 't')),
      sv: pick(r, 'Sv', 'sv') || '-',
      invSv: pick(r, 'inv_sv', 'invSv') || '',
      w,
      ld: pick(r, 'Ld', 'ld') || '-',
      oc: num(pick(r, 'OC', 'oc')),
      baseMm: base.mm,
      baseShape: base.shape,
      baseW: base.w,
      baseH: base.h,
    };
  });

  const weaponsByDs = byDs<Weapon>(wargearRows, (r) => {
    const type = pick(r, 'type');
    const range = pick(r, 'range') || (/melee/i.test(type) ? 'Melee' : '');
    return {
      name: pick(r, 'name') || 'Weapon',
      type: /melee/i.test(type) || /melee/i.test(range) ? 'melee' : 'ranged',
      range,
      a: pick(r, 'A', 'a'),
      skill: pick(r, 'BS_WS', 'bs_ws', 'skill'),
      s: pick(r, 'S', 's'),
      ap: pick(r, 'AP', 'ap'),
      d: pick(r, 'D', 'd'),
      keywords: stripHtml(pick(r, 'description', 'keywords')),
    };
  });

  const abilitiesByDs = byDs<Ability>(abilityRows, (r) => {
    const aid = pick(r, 'ability_id');
    const linked = aid ? abilityLookup.get(aid) : undefined;
    return {
      name: pick(r, 'name') || linked?.name || 'Ability',
      description: stripHtml(pick(r, 'description') || linked?.description || ''),
      type: pick(r, 'type'),
      parameter: pick(r, 'parameter'),
    };
  });

  // Leader -> Bodyguard links. Datasheets_leader.csv: leader_id | attached_id.
  // Resolve attached_id to a datasheet name using a global id->name map.
  const nameById = new Map<string, string>();
  for (const r of dsRows) {
    const id = pick(r, 'id');
    const name = pick(r, 'name');
    if (id && name) nameById.set(id, name);
  }
  const leadsByDs = new Map<string, string[]>();
  for (const r of readCsv('Datasheets_leader.csv')) {
    const leaderId = pick(r, 'leader_id', 'datasheet_id');
    const attachedId = pick(r, 'attached_id', 'attached_datasheet_id');
    const attachedName = nameById.get(attachedId);
    if (!leaderId || !attachedName) continue;
    const arr = leadsByDs.get(leaderId) ?? leadsByDs.set(leaderId, []).get(leaderId)!;
    if (!arr.includes(attachedName)) arr.push(attachedName);
  }

  const datasheets: DatasheetRecord[] = [];
  for (const r of dsRows) {
    const factionId = pick(r, 'faction_id');
    if (!wantedFactions.has(factionId)) continue;
    const id = pick(r, 'id');
    const name = pick(r, 'name');
    if (!id || !name) continue;
    const role = pick(r, 'role');
    const keywords = keywordsByDs.get(id) ?? [];
    // base size lives on the model rows; use the first model's base for the datasheet
    const profiles = profilesByDs.get(id) ?? [];
    const p0 = profiles[0];

    datasheets.push({
      id,
      name,
      factionId,
      role,
      baseMm: p0?.baseMm ?? 32,
      baseShape: p0?.baseShape ?? 'circle',
      baseW: p0?.baseW ?? p0?.baseMm ?? 32,
      baseH: p0?.baseH ?? p0?.baseMm ?? 32,
      background: stripHtml(pick(r, 'legend', 'loadout')),
      profiles,
      weapons: weaponsByDs.get(id) ?? [],
      abilities: abilitiesByDs.get(id) ?? [],
      keywords,
      leads: leadsByDs.get(id) ?? [],
    });
  }

  if (datasheets.length === 0) {
    console.error('[ingest] No datasheets matched the Xenos factions — check the CSVs.');
    process.exit(1);
  }

  // ---- detachment-level data (faction-scoped) ----
  const factionNameById = new Map<string, string>();
  for (const f of wantedFactions.values()) factionNameById.set(f.id, f.name);

  // Real matched-play detachments only. Detachments.csv tags Boarding Actions
  // detachments via its `type` column; standard codex detachments have an empty
  // type. Build the set of valid (faction, detachment) pairs so we drop
  // boarding-action rules and stray artifacts (e.g. an "Army Rules" pseudo-
  // detachment) from the stratagem/ability/enhancement data below.
  const validDet = new Set<string>();
  for (const r of readCsv('Detachments.csv')) {
    const fid = pick(r, 'faction_id');
    if (!wantedFactions.has(fid)) continue;
    if (pick(r, 'type') === 'Boarding Actions') continue;
    const name = pick(r, 'name');
    if (name) validDet.add(`${fid}|${name.toLowerCase().trim()}`);
  }
  // Keep a row if it has no detachment (core/army-wide) or names a valid one.
  const detOk = (fid: string, det: string) => {
    const d = (det || '').toLowerCase().trim();
    return d === '' || validDet.has(`${fid}|${d}`);
  };

  const stratagems: StratagemRecord[] = [];
  for (const r of readCsv('Stratagems.csv')) {
    const fid = pick(r, 'faction_id');
    if (!wantedFactions.has(fid)) continue;
    if (!detOk(fid, pick(r, 'detachment'))) continue;
    stratagems.push({
      factionName: factionNameById.get(fid)!,
      detachment: pick(r, 'detachment'),
      name: pick(r, 'name'),
      type: pick(r, 'type'),
      cpCost: pick(r, 'cp_cost'),
      turn: pick(r, 'turn'),
      phase: pick(r, 'phase'),
      description: stripHtml(pick(r, 'description')),
    });
  }

  const detachmentAbilities: DetachmentAbilityRecord[] = [];
  for (const r of readCsv('Detachment_abilities.csv')) {
    const fid = pick(r, 'faction_id');
    if (!wantedFactions.has(fid)) continue;
    if (!detOk(fid, pick(r, 'detachment'))) continue;
    detachmentAbilities.push({
      factionName: factionNameById.get(fid)!,
      detachment: pick(r, 'detachment'),
      name: pick(r, 'name'),
      description: stripHtml(pick(r, 'description')),
    });
  }

  const enhancements: EnhancementRecord[] = [];
  for (const r of readCsv('Enhancements.csv')) {
    const fid = pick(r, 'faction_id');
    if (!wantedFactions.has(fid)) continue;
    if (!detOk(fid, pick(r, 'detachment'))) continue;
    enhancements.push({
      factionName: factionNameById.get(fid)!,
      detachment: pick(r, 'detachment'),
      name: pick(r, 'name'),
      cost: pick(r, 'cost'),
      description: stripHtml(pick(r, 'description')),
    });
  }

  console.log(
    `[ingest] factions: ${wantedFactions.size}, datasheets: ${datasheets.length}, ` +
      `stratagems: ${stratagems.length}, detachment abilities: ${detachmentAbilities.length}, enhancements: ${enhancements.length}`
  );
  buildDatabase([...wantedFactions.values()], datasheets, {
    stratagems,
    detachmentAbilities,
    enhancements,
  });
}

main();
