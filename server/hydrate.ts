import levenshtein from 'fast-levenshtein';
import { nanoid } from 'nanoid';
import type {
  HydratedRoster,
  HydratedUnit,
  ModelProfile,
  RawRoster,
  RawUnit,
} from '../shared/types.js';
import {
  allDatasheetIndex,
  getDatasheet,
  getDatasheetByNorm,
  type DatasheetIndexEntry,
} from './db.js';
import { normalizeName } from './normalize.js';

const FUZZY_THRESHOLD = 0.78; // token-set similarity acceptance floor

// Token-set similarity (0..1): order-independent, robust to extra words.
function tokenSetSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  const jaccard = inter / union;
  // Blend with normalized edit distance for short names.
  const dist = levenshtein.get(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  const editSim = 1 - dist / maxLen;
  return Math.max(jaccard, editSim * 0.9);
}

function bestFuzzy(
  nameNorm: string,
  index: DatasheetIndexEntry[]
): { entry: DatasheetIndexEntry; score: number } | null {
  let best: DatasheetIndexEntry | null = null;
  let bestScore = 0;
  for (const e of index) {
    const score = tokenSetSimilarity(nameNorm, e.nameNorm);
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best ? { entry: best, score: bestScore } : null;
}

function hydrateUnit(
  raw: RawUnit,
  factionName: string | undefined,
  factionIndex: DatasheetIndexEntry[],
  globalIndex: DatasheetIndexEntry[]
): HydratedUnit {
  const nameNorm = normalizeName(raw.rawName);
  const modelCount = raw.models.reduce((sum, m) => sum + m.count, 0) || 1;

  const base: HydratedUnit = {
    id: nanoid(8),
    rawName: raw.rawName,
    datasheetId: null,
    matchConfidence: 0,
    points: raw.points,
    modelCount,
    baseMm: 32,
    wargear: raw.wargear,
    enhancements: raw.enhancements,
  };

  // 1 & 2: exact name_norm (faction first, then global)
  let ds = getDatasheetByNorm(nameNorm, factionName);
  let confidence = ds ? 1 : 0;

  // 3: fuzzy
  if (!ds) {
    const pool = factionIndex.length ? factionIndex : globalIndex;
    const fuzzy = bestFuzzy(nameNorm, pool) ?? bestFuzzy(nameNorm, globalIndex);
    if (fuzzy && fuzzy.score >= FUZZY_THRESHOLD) {
      ds = getDatasheet(fuzzy.entry.id);
      confidence = Math.round(fuzzy.score * 100) / 100;
    }
  }

  if (!ds) return base; // 4: unmatched

  const dsBase = ds.baseMm || 32;

  // Map each roster model line to a datasheet model profile (by name) so we can
  // give every model its own base size + wounds (e.g. Ghazghkull 80mm / Makari 25mm).
  const profileFor = (modelName: string): ModelProfile | undefined => {
    const mn = normalizeName(modelName);
    return (
      ds!.profiles.find((p) => normalizeName(p.modelName) === mn) ??
      ds!.profiles.find((p) => normalizeName(p.modelName).includes(mn) || mn.includes(normalizeName(p.modelName)))
    );
  };
  const modelLines = raw.models.map((m) => {
    const prof = ds!.profiles.length > 1 ? profileFor(m.name) : ds!.profiles[0];
    return {
      count: m.count,
      name: m.name,
      baseMm: prof?.baseMm ?? dsBase,
      woundsEach: prof?.w ?? ds!.profiles[0]?.w ?? 1,
      baseShape: prof?.baseShape ?? ds!.baseShape,
      baseW: prof?.baseW ?? ds!.baseW,
      baseH: prof?.baseH ?? ds!.baseH,
    };
  });

  return {
    ...base,
    datasheetId: ds.id,
    matchConfidence: confidence,
    profile: ds.profiles[0],
    altProfiles: ds.profiles.length > 1 ? ds.profiles : undefined,
    weapons: ds.weapons,
    abilities: ds.abilities,
    keywords: ds.keywords,
    leads: ds.leads,
    baseMm: dsBase,
    baseShape: ds.baseShape,
    baseW: ds.baseW,
    baseH: ds.baseH,
    modelLines,
  };
}

export function hydrateRoster(raw: RawRoster): HydratedRoster {
  const factionIndex = raw.faction ? allDatasheetIndex(raw.faction) : [];
  const globalIndex = allDatasheetIndex();

  const units = raw.units.map((u) =>
    hydrateUnit(u, raw.faction, factionIndex, globalIndex)
  );

  // 11th ed allows multiple detachments. New Recruit currently exports only one,
  // so default the array to that single detachment until the export format adds more.
  const detachments = raw.detachments?.length
    ? raw.detachments
    : raw.detachment
      ? [raw.detachment]
      : [];

  return {
    armyName: raw.armyName,
    faction: raw.faction,
    detachment: raw.detachment ?? detachments[0],
    detachments,
    declaredPoints: raw.declaredPoints,
    units,
    unmatchedCount: units.filter((u) => u.datasheetId === null).length,
  };
}
