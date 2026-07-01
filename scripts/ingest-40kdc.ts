/**
 * Builds data/stats.sqlite from the community 40kdc-data project (11th edition).
 *
 *   Source: https://github.com/wn-mitch/40kdc-data  (CC-BY 4.0, "Alpaca Software
 *   and the 40kdc community contributors" — see the credit in the app footer).
 *
 * Unlike the Wahapedia importer (10th-edition CSVs), this pulls structured 11th-
 * edition JSON — datasheet stat lines, points, base sizes, weapon profiles,
 * keywords, detachments / stratagems / enhancements — straight from GitHub.
 *
 *   Run:  npm run ingest:40kdc
 *
 * The datasheet *stats* are facts (numbers, points, base sizes). The community's
 * ability/stratagem effect encodings are a machine-readable DSL, not display
 * prose, so we import ability/stratagem NAMES + metadata (CP, phase, points) and
 * leave the human-readable effect text blank — the 11th-ed detachment overrides
 * (client/src/data/detachments11e.ts) and the in-app editor fill that in.
 */
import {
  buildDatabase,
  type DatasheetRecord,
  type DetachmentAbilityRecord,
  type EnhancementRecord,
  type FactionRecord,
  type StratagemRecord,
} from './dbBuild.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import type { Ability, BaseShape, ModelProfile, Weapon } from '../shared/types.js';
import { hullRect } from './hullSizes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WAHA_DIR = path.resolve(__dirname, '../data/wahapedia');

const REPO = 'wn-mitch/40kdc-data';
const RAW = (p: string) => `https://raw.githubusercontent.com/${REPO}/main/${p}`;
const TREE = `https://api.github.com/repos/${REPO}/git/trees/HEAD?recursive=1`;

async function getJson<T>(url: string): Promise<T | null> {
  const r = await fetch(url, { headers: { 'User-Agent': '40k-vtt-ingest' } });
  if (!r.ok) return null;
  return (await r.json()) as T;
}

// ---- 40kdc JSON shapes (only the fields we consume) ----
interface Faction40 { id: string; name: string; parent_faction_id: string | null }
interface BaseSize {
  shape: 'round' | 'oval' | 'hull' | 'flying-base' | 'unique';
  diameter?: number;
  width?: number;
  length?: number;
}
interface UnitProfile {
  name: string;
  M: number; T: number; W: number; Sv: number;
  invuln_sv: number | null; Ld: number; OC: number;
}
interface Unit40 {
  id: string; name: string; faction_id: string; role: string;
  profiles: UnitProfile[];
  points?: { models: number; cost: number }[];
  keywords?: string[]; faction_keywords?: string[];
  base_size_mm?: BaseSize;
  weapon_ids?: string[]; ability_ids?: string[];
}
interface WeaponStats { A?: unknown; S?: unknown; AP?: unknown; D?: unknown; BS?: unknown; WS?: unknown }
interface WeaponProfile { name: string; range: unknown; stats: WeaponStats; keywords?: { keyword_id: string }[] }
interface Weapon40 { id: string; name: string; type: 'ranged' | 'melee'; profiles: WeaponProfile[] }
interface Ability40 { ability_id: string; name: string }
interface LeaderAttach { leader_id: string; eligible_bodyguard_ids: string[] }
interface Detachment40 {
  id: string; name: string; faction_id: string;
  detachment_points?: number;
  detachment_rule_id?: string | null;
}
interface Stratagem40 {
  name: string; detachment_id: string | null;
  type?: string; cp_cost?: number; player_turn?: string; phases?: string[];
}
interface Enhancement40 { name: string; detachment_id: string | null; cost?: number }

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
// "sustained-hits-1" / "precision" -> "Sustained Hits 1" / "Precision"
const humanize = (id: string): string =>
  id
    .split('-')
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

// ---- ability text backfill from a local Wahapedia export (optional) ----
// 40kdc encodes ability effects as a DSL, not readable prose. If the user has a
// Wahapedia CSV export in data/wahapedia/, we borrow the human-readable effect
// text for any ability whose name matches (Wahapedia is 10th ed, so this is
// best-effort — abilities new in 11th simply stay blank until Wahapedia updates).
const stripHtml = (s: string): string =>
  (s || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#?\w+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Normalise an ability name for matching: drop parentheticals, dice/number
// parameters and punctuation ("Feel No Pain 5+" ~ "Deadly Demise D3" -> stem).
const normAbility = (n: string): string =>
  (n || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\bd\d+\b/g, ' ')
    .replace(/\d+\+?/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Universal keyword-style abilities render as compact tags, not paragraphs.
const CORE_ABILITIES = new Set(
  [
    'leader', 'scouts', 'deep strike', 'infiltrators', 'lone operative', 'stealth',
    'fights first', 'feel no pain', 'deadly demise', 'firing deck', 'benefit of cover',
  ]
);

const pickCsv = (row: Record<string, string>, ...keys: string[]): string => {
  const lower: Record<string, string> = {};
  for (const k of Object.keys(row)) lower[k.toLowerCase()] = row[k];
  for (const k of keys) if (lower[k.toLowerCase()]) return lower[k.toLowerCase()];
  return '';
};

function readWahaCsv(file: string): Record<string, string>[] {
  const full = path.join(WAHA_DIR, file);
  if (!fs.existsSync(full)) return [];
  return parse(fs.readFileSync(full, 'utf-8').replace(/^﻿/, ''), {
    delimiter: '|', columns: true, skip_empty_lines: true,
    relax_quotes: true, relax_column_count: true, trim: true,
  });
}

// Plain name normaliser (keeps digits) for datasheet/model matching.
const normNm = (s: string): string => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function loadWahaAbilities(): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of ['Abilities.csv', 'Datasheets_abilities.csv']) {
    for (const r of readWahaCsv(file)) {
      const name = pickCsv(r, 'name');
      const desc = stripHtml(pickCsv(r, 'description'));
      if (!name || !desc) continue;
      const k = normAbility(name);
      if (k && !map.has(k)) map.set(k, desc);
    }
  }
  return map;
}

type WahaBase = { shape: BaseShape; mm: number; w: number; h: number };

// Parse a Wahapedia base_size string: "25mm" -> circle, "120 x 92mm" -> oval.
// Returns null for hull / "Use model" / unparseable (caller keeps the 40kdc base).
function parseWahaBase(s: string): WahaBase | null {
  const t = (s || '').toLowerCase();
  const oval = t.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  if (oval) {
    const w = parseFloat(oval[1]), h = parseFloat(oval[2]);
    return { shape: 'oval', mm: Math.max(w, h), w, h };
  }
  const circ = t.match(/(\d+(?:\.\d+)?)\s*mm/);
  if (circ) {
    const d = parseFloat(circ[1]);
    return { shape: 'circle', mm: d, w: d, h: d };
  }
  return null;
}

// Per-model base sizes from Wahapedia, keyed by "<datasheet>|<model>". 40kdc only
// carries a single unit-level base, so companion models that share a datasheet but
// sit on a different base (e.g. Makari on Ghazghkull's sheet) come out wrong; this
// restores the authoritative per-model size for multi-profile units.
function loadWahaModelBases(): Map<string, WahaBase> {
  const map = new Map<string, WahaBase>();
  const dsName = new Map<string, string>();
  for (const r of readWahaCsv('Datasheets.csv')) {
    const id = pickCsv(r, 'id');
    const name = pickCsv(r, 'name');
    if (id && name) dsName.set(id, name);
  }
  for (const r of readWahaCsv('Datasheets_models.csv')) {
    const ds = dsName.get(pickCsv(r, 'datasheet_id'));
    const model = pickCsv(r, 'name', 'model_name');
    const base = parseWahaBase(pickCsv(r, 'base_size', 'base_size_descr'));
    if (!ds || !model || !base) continue;
    map.set(`${normNm(ds)}|${normNm(model)}`, base);
  }
  return map;
}

function baseInfo(b: BaseSize | undefined, name: string, wounds: number): {
  shape: BaseShape; mm: number; w: number; h: number;
} {
  if (b) {
    if (b.shape === 'round' && b.diameter) {
      return { shape: 'circle', mm: b.diameter, w: b.diameter, h: b.diameter };
    }
    if ((b.shape === 'oval' || b.shape === 'flying-base') && b.width && b.length) {
      const mm = Math.max(b.width, b.length);
      return { shape: 'oval', mm, w: b.width, h: b.length };
    }
    // flying-base with a stem diameter but no footprint -> treat as round
    if (b.shape === 'flying-base' && b.diameter) {
      return { shape: 'circle', mm: b.diameter, w: b.diameter, h: b.diameter };
    }
  }
  // hull / unique / draft with no dimensions -> physical hull footprint
  const [w, h] = hullRect(name, wounds);
  return { shape: 'rect', mm: Math.max(w, h), w, h };
}

async function main() {
  console.log('[40kdc] fetching file tree…');
  const tree = await getJson<{ tree: { path: string; type: string }[] }>(TREE);
  if (!tree) throw new Error('Could not fetch repo tree from GitHub API');

  // faction folders: data/core/<slug>  (skip _example, _reports, …)
  const slugs = tree.tree
    .filter((t) => t.type === 'tree' && /^data\/core\/[^_/][^/]*$/.test(t.path))
    .map((t) => t.path.split('/')[2]);
  console.log(`[40kdc] ${slugs.length} faction folders`);

  // shared core abilities (Leader, Deadly Demise, Scouts, …)
  const abilityName = new Map<string, string>();
  const coreAb = (await getJson<Ability40[]>(RAW('data/enrichment/_core/abilities.json'))) ?? [];
  for (const a of coreAb) if (a.ability_id) abilityName.set(a.ability_id, a.name);

  // optional human-readable effect text + per-model base sizes from a local Wahapedia export
  const wahaText = loadWahaAbilities();
  const wahaModelBase = loadWahaModelBases();
  let abBackfilled = 0;
  let abTotal = 0;
  console.log(
    wahaText.size
      ? `[40kdc] loaded ${wahaText.size} ability descriptions from data/wahapedia/ for backfill`
      : `[40kdc] no data/wahapedia/ export found — ability effect text will be blank`
  );

  const factions: FactionRecord[] = [];
  const datasheets: DatasheetRecord[] = [];
  const stratagems: StratagemRecord[] = [];
  const enhancements: EnhancementRecord[] = [];
  const detachmentAbilities: DetachmentAbilityRecord[] = [];

  for (const slug of slugs) {
    const base = `data/core/${slug}`;
    const [facs, units, weapons, abils, leaders, dets, strats, enhs] = await Promise.all([
      getJson<Faction40[]>(RAW(`${base}/factions.json`)),
      getJson<Unit40[]>(RAW(`${base}/units.json`)),
      getJson<Weapon40[]>(RAW(`${base}/weapons.json`)),
      getJson<Ability40[]>(RAW(`data/enrichment/${slug}/abilities.json`)),
      getJson<LeaderAttach[]>(RAW(`${base}/leader-attachments.json`)),
      getJson<Detachment40[]>(RAW(`${base}/detachments.json`)),
      getJson<Stratagem40[]>(RAW(`${base}/stratagems.json`)),
      getJson<Enhancement40[]>(RAW(`${base}/enhancements.json`)),
    ]);
    if (!facs) {
      console.warn(`[40kdc] ${slug}: missing factions.json — skipped`);
      continue;
    }
    // Space Marine chapters (Black Templars, Space Wolves, Dark Angels, …) carry
    // no units.json of their own — they use the Adeptus Astartes datasheets — but
    // they DO have their own detachments/stratagems/enhancements. Import those.
    const unitList = units ?? [];

    const primary = facs.find((f) => !f.parent_faction_id) ?? facs[0];
    for (const f of facs) factions.push({ id: f.id, name: f.name });
    const factionName = primary.name;

    // per-faction ability names
    for (const a of abils ?? []) if (a.ability_id) abilityName.set(a.ability_id, a.name);

    const weaponById = new Map<string, Weapon40>();
    for (const w of weapons ?? []) weaponById.set(w.id, w);

    // unit_id -> [bodyguard display names]
    const unitNameById = new Map(unitList.map((u) => [u.id, u.name] as const));
    const leadsById = new Map<string, string[]>();
    for (const l of leaders ?? []) {
      const names = (l.eligible_bodyguard_ids ?? [])
        .map((id) => unitNameById.get(id))
        .filter((n): n is string => !!n);
      if (names.length) leadsById.set(l.leader_id, names);
    }

    for (const u of unitList) {
      const wMax = Math.max(1, ...u.profiles.map((p) => p.W || 1));
      const b = baseInfo(u.base_size_mm, u.name, wMax);

      // Multi-profile units can mix base sizes (Ghazghkull 80mm + Makari 25mm) but
      // 40kdc only gives one unit base, so pull each model's real base from Wahapedia.
      const multiProfile = u.profiles.length > 1;
      const profiles: ModelProfile[] = u.profiles.map((p) => {
        let pb: { shape: BaseShape; mm: number; w: number; h: number } = b;
        if (multiProfile) {
          const wb = wahaModelBase.get(`${normNm(u.name)}|${normNm(p.name || u.name)}`);
          if (wb) pb = wb;
        }
        return {
          modelName: p.name || u.name,
          m: p.M ?? 0,
          t: p.T ?? 0,
          sv: p.Sv != null ? `${p.Sv}+` : '-',
          invSv: p.invuln_sv != null ? `${p.invuln_sv}+` : '',
          w: p.W ?? 1,
          ld: p.Ld != null ? `${p.Ld}+` : '-',
          oc: p.OC ?? 0,
          baseMm: pb.mm,
          baseShape: pb.shape,
          baseW: pb.w,
          baseH: pb.h,
        };
      });

      const wpns: Weapon[] = [];
      for (const wid of u.weapon_ids ?? []) {
        const w = weaponById.get(wid);
        if (!w) continue;
        const multi = w.profiles.length > 1;
        for (const pr of w.profiles) {
          const melee = w.type === 'melee';
          const label = multi && pr.name && pr.name !== w.name ? `${w.name} – ${pr.name}` : w.name;
          wpns.push({
            name: label,
            type: melee ? 'melee' : 'ranged',
            range: melee ? 'Melee' : typeof pr.range === 'number' ? `${pr.range}"` : s(pr.range) || 'Melee',
            a: s(pr.stats.A),
            skill: melee
              ? pr.stats.WS != null ? `${s(pr.stats.WS)}+` : ''
              : pr.stats.BS != null ? `${s(pr.stats.BS)}+` : '',
            s: s(pr.stats.S),
            ap: s(pr.stats.AP),
            d: s(pr.stats.D),
            keywords: (pr.keywords ?? []).map((k) => humanize(k.keyword_id)).join(', '),
          });
        }
      }

      const abilities: Ability[] = (u.ability_ids ?? []).map((id) => {
        const name = abilityName.get(id) ?? humanize(id);
        const key = normAbility(name);
        const description = wahaText.get(key) ?? '';
        abTotal++;
        if (description) abBackfilled++;
        return {
          name,
          description, // borrowed from Wahapedia where the name matches, else blank
          type: CORE_ABILITIES.has(key) ? 'core' : '',
          parameter: '',
          // the borrowed prose is 10th-edition wording — flag it so the UI can say so
          textEdition: description ? '10e' : '',
        };
      });

      datasheets.push({
        // Shared units (Agents, allied vehicles, …) reuse the same slug id across
        // several faction files, so namespace by faction to keep each faction's
        // copy. The id is only an internal handle (the app resolves units by name).
        id: `${u.faction_id}:${u.id}`,
        name: u.name,
        factionId: u.faction_id,
        role: u.role ?? '',
        baseMm: b.mm,
        baseShape: b.shape,
        baseW: b.w,
        baseH: b.h,
        points: u.points?.[0]?.cost ?? null,
        background: '',
        profiles,
        weapons: wpns,
        abilities,
        keywords: [...(u.keywords ?? []), ...(u.faction_keywords ?? [])],
        leads: leadsById.get(u.id) ?? [],
      });
    }

    // ---- detachment-scoped rules (names + metadata; effect prose left blank) ----
    const detNameById = new Map<string, string>();
    for (const d of dets ?? []) detNameById.set(d.id, d.name);
    const detName = (id: string | null | undefined) => (id ? detNameById.get(id) ?? '' : '');

    for (const st of strats ?? []) {
      stratagems.push({
        factionName,
        detachment: detName(st.detachment_id),
        name: st.name,
        type: st.type ? humanize(st.type) : '',
        cpCost: st.cp_cost != null ? String(st.cp_cost) : '',
        turn: st.player_turn ? humanize(st.player_turn) : '',
        phase: (st.phases ?? []).map(humanize).join(', '),
        description: '',
      });
    }
    for (const e of enhs ?? []) {
      enhancements.push({
        factionName,
        detachment: detName(e.detachment_id),
        name: e.name,
        cost: e.cost != null ? String(e.cost) : '',
        description: '',
      });
    }
    // one detachment_ability row per detachment carries its DP cost + rule name,
    // so the detachment list + budget resolve for every 11th-ed detachment.
    for (const d of dets ?? []) {
      detachmentAbilities.push({
        factionName,
        detachment: d.name,
        name: abilityName.get(d.detachment_rule_id ?? '') ?? 'Detachment rule',
        description: d.detachment_points != null ? `${d.detachment_points} DP` : '',
      });
    }

    console.log(`[40kdc] ${slug}: ${unitList.length} units, ${(dets ?? []).length} detachments`);
  }

  if (datasheets.length === 0) throw new Error('No datasheets imported — aborting.');

  // de-dupe factions (chapters can repeat a shared parent id)
  const factionMap = new Map(factions.map((f) => [f.id, f]));
  console.log(
    `\n[40kdc] factions: ${factionMap.size}, datasheets: ${datasheets.length}, ` +
      `stratagems: ${stratagems.length}, enhancements: ${enhancements.length}`
  );
  if (abTotal)
    console.log(
      `[40kdc] ability text: ${abBackfilled}/${abTotal} backfilled from Wahapedia ` +
        `(${Math.round((abBackfilled / abTotal) * 100)}%)`
    );
  buildDatabase([...factionMap.values()], datasheets, {
    stratagems,
    detachmentAbilities,
    enhancements,
  });
}

main().catch((e) => {
  console.error('[40kdc] ingest failed:', e);
  process.exit(1);
});
