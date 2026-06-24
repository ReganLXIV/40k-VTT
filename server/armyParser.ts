import type { RawRoster, RawUnit } from '../shared/types.js';

// Parses New Recruit plain-text exports into a RawRoster. New Recruit has several
// export styles; this handles both:
//  (A) classic:  "Overlord (110 Points)" then "  • 1x Overlord" + indented wargear
//  (B) "+ header" style:
//        + FACTION KEYWORD: Xenos - Orks
//        Char1: 2x Ghazghkull Thraka (235 pts): Warlord
//        • 1x Ghazghkull Thraka: Gork's Klaw, Mork's Roar
//        20x Boyz (170 pts)
//        • 19x Boy: 19 with Choppa, Slugga
//        6x Meganobz (190 pts): 6 with Twin killsaw
// Be defensive — formats drift.

const POINTS = /\(\s*(\d+)\s*(?:pts?|points?)\s*\)/i;
// optional "Nx " leading count, name, "(N pts)", optional trailing ": ..."
const UNIT_RE = /^(?:(\d+)x\s+)?(.+?)\s*\(\s*(\d+)\s*(?:pts?|points?)\s*\)\s*(?::\s*(.+))?$/i;
const MODEL_RE = /^[•*▪‣·]\s*(\d+)x\s+([^:]+?)\s*(?::\s*(.+))?$/;
const WARGEAR_LINE_RE = /^(\d+)x\s+(.+?)\s*$/i;
const FACTION_VALUE_RE = /(?:xenos|imperium|chaos|unaligned|aeldari)?\s*[-–—]?\s*([A-Za-z'’ .]+?)\s*$/i;
const CLASSIC_FACTION_RE = /^(?:xenos|imperium|chaos)\s*[-–—]\s*(.+?)\s*$/i;
const CHAR_PREFIX_RE = /^\s*char\d+\s*:\s*/i;
const DECORATION_RE = /^[+=\-_*\s]+$/; // lines like "++++++" or a lone "+"

const SECTION_WORDS = new Set([
  'CHARACTER', 'CHARACTERS', 'EPIC HERO', 'EPIC HEROES', 'BATTLELINE',
  'DEDICATED TRANSPORTS', 'DEDICATED TRANSPORT', 'OTHER DATASHEETS',
  'OTHER DATASHEET', 'ALLIED UNITS', 'INFANTRY', 'VEHICLE', 'VEHICLES',
  'MONSTER', 'MONSTERS',
]);

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t || POINTS.test(t)) return false;
  if (SECTION_WORDS.has(t.toUpperCase())) return true;
  const isCaps = t === t.toUpperCase() && /[A-Z]/.test(t) && t.length < 40;
  return isCaps;
}

function looksLikeEnhancement(s: string): boolean {
  return /enhancement/i.test(s);
}

// Split an inline wargear segment ("19 with Choppa, Slugga" / "Power klaw, Slugga")
// into individual entries, stripping "N with " / "Nx " prefixes.
function addWargear(unit: RawUnit, seg: string) {
  for (let part of seg.split(',')) {
    part = part
      .replace(/^\s*\d+\s+with\s+/i, '')
      .replace(/^\s*\d+x\s+/i, '')
      .trim();
    if (!part) continue;
    if (looksLikeEnhancement(part)) {
      unit.enhancements.push(part.replace(/\s*\(enhancement\)/i, '').trim());
    } else {
      unit.wargear.push(part);
    }
  }
}

export function parseArmy(text: string): RawRoster {
  const lines = text.split(/\r?\n/);
  const roster: RawRoster = { units: [] };

  let current: RawUnit | null = null;
  let currentSection: string | undefined;
  let sawFirstUnit = false;
  let plusFormat = false;

  const indentOf = (l: string) => l.match(/^\s*/)?.[0].length ?? 0;

  const finalizeCurrent = () => {
    if (!current) return;
    // If no models were enumerated as bullets, synthesize one from the unit count.
    if (current.models.length === 0) {
      current.models.push({
        count: current.declaredModels ?? 1,
        name: current.rawName,
      });
    }
    roster.units.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Decoration separators ("+++++", lone "+")
    if (DECORATION_RE.test(line)) continue;

    // "+ KEY: value" header block (format B)
    if (line.startsWith('+')) {
      plusFormat = true;
      const body = line.replace(/^\+\s*/, '');
      const ci = body.indexOf(':');
      if (ci > -1) {
        const key = body.slice(0, ci).trim().toUpperCase();
        const val = body.slice(ci + 1).trim();
        if (key.includes('FACTION')) {
          const m = val.match(CLASSIC_FACTION_RE) || val.match(FACTION_VALUE_RE);
          roster.faction = (m?.[1] ?? val).trim();
        } else if (key.includes('DETACHMENT')) {
          roster.detachment = val;
        } else if (key.includes('TOTAL') && key.includes('POINTS')) {
          const n = val.match(/\d+/);
          if (n) roster.declaredPoints = parseInt(n[0], 10);
        }
      }
      continue;
    }

    // Classic faction line: "Xenos - Necrons"
    const cf = line.match(CLASSIC_FACTION_RE);
    if (cf && !POINTS.test(line) && !roster.faction) {
      roster.faction = cf[1].trim();
      continue;
    }

    // Model bullet line: "• 19x Boy: 19 with Choppa, Slugga"
    const mm = line.match(MODEL_RE);
    if (mm && current) {
      const count = parseInt(mm[1], 10);
      const name = mm[2].trim();
      current.models.push({ count, name });
      if (mm[3]) addWargear(current, mm[3]);
      continue;
    }

    // Unit line: optional "CharN:" prefix, optional "Nx", name, "(N pts)", optional ": ..."
    const hadCharPrefix = CHAR_PREFIX_RE.test(line);
    const stripped = line.replace(CHAR_PREFIX_RE, '');
    const um = stripped.match(UNIT_RE);
    if (um && POINTS.test(stripped)) {
      const leadingCount = um[1] ? parseInt(um[1], 10) : undefined;
      const name = um[2].trim();
      const points = parseInt(um[3], 10);
      const trailing = um[4]?.trim();

      // Classic army-header line ("Sample Necron Army (1000 Points)") only when we
      // are NOT in the "+ header" format and the line has no count/role prefix.
      if (
        !plusFormat &&
        !hadCharPrefix &&
        leadingCount === undefined &&
        !sawFirstUnit &&
        roster.armyName === undefined &&
        !trailing
      ) {
        roster.armyName = name;
        roster.declaredPoints = roster.declaredPoints ?? points;
        continue;
      }

      // Classic detachment/board-size line right after the header.
      if (
        !plusFormat &&
        roster.units.length === 0 &&
        !current &&
        /^(strike force|incursion|combat patrol|onslaught)$/i.test(name)
      ) {
        continue;
      }

      // Start a new unit.
      finalizeCurrent();
      current = {
        rawName: name,
        points,
        models: [],
        wargear: [],
        enhancements: [],
        section: currentSection,
        declaredModels: leadingCount,
      };
      sawFirstUnit = true;

      if (trailing) {
        if (/^warlord$/i.test(trailing)) current.warlord = true;
        else addWargear(current, trailing);
      }
      continue;
    }

    // Section header (hint only)
    if (isSectionHeader(line)) {
      currentSection = line.trim();
      continue;
    }

    // Indented classic wargear sub-line: "1x Tachyon arrow"
    const wm = line.match(WARGEAR_LINE_RE);
    if (wm && current && indentOf(rawLine) > 0) {
      const wName = wm[2].trim();
      if (looksLikeEnhancement(wName)) {
        current.enhancements.push(wName.replace(/\s*\(enhancement\)/i, '').trim());
      } else {
        current.wargear.push(`${wm[1]}x ${wName}`);
      }
      continue;
    }

    // Explicit "Enhancements: ..." line
    if (/^enhancements?\s*:/i.test(line) && current) {
      const rest = line.replace(/^enhancements?\s*:/i, '').trim();
      if (rest) current.enhancements.push(rest);
      continue;
    }

    // Lone classic detachment line before any unit.
    if (!current && roster.units.length === 0 && roster.faction && !roster.detachment) {
      roster.detachment = line;
      continue;
    }
  }

  finalizeCurrent();
  return roster;
}
