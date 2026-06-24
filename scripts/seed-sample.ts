/**
 * Builds a small SAMPLE stats.sqlite so the app is fully testable without the
 * Wahapedia download. Stats here are illustrative placeholders (clearly marked),
 * not the official datasheet values. Run `npm run ingest` with the real CSVs for
 * accurate stats. Unit *names* are factual references used for list matching.
 */
import {
  buildDatabase,
  type DatasheetRecord,
  type FactionRecord,
} from './dbBuild.js';
import type { Ability, ModelProfile, Weapon } from '../shared/types.js';

const SAMPLE = '[SAMPLE DATA — run npm run ingest for official stats]';

function p(
  modelName: string,
  m: number,
  t: number,
  sv: string,
  w: number,
  ld: string,
  oc: number,
  invSv = ''
): ModelProfile {
  return { modelName, m, t, sv, invSv, w, ld, oc };
}

function rw(name: string, range: string, a: string, skill: string, s: string, ap: string, d: string, keywords = ''): Weapon {
  return { name, type: 'ranged', range, a, skill, s, ap, d, keywords };
}
function mw(name: string, a: string, skill: string, s: string, ap: string, d: string, keywords = ''): Weapon {
  return { name, type: 'melee', range: 'Melee', a, skill, s, ap, d, keywords };
}
function ab(name: string): Ability {
  return { name, description: `${name} — see your codex for the full rule. ${SAMPLE}` };
}

const factions: FactionRecord[] = [
  { id: 'NEC', name: 'Necrons' },
  { id: 'ORK', name: 'Orks' },
  { id: 'TYR', name: 'Tyranids' },
  { id: 'TAU', name: "T'au Empire" },
  { id: 'AE', name: 'Aeldari' },
];

let n = 0;
const id = () => `ds_${(++n).toString().padStart(3, '0')}`;

function ds(
  name: string,
  factionId: string,
  role: string,
  baseMm: number,
  profiles: ModelProfile[],
  weapons: Weapon[],
  abilities: Ability[],
  keywords: string[]
): DatasheetRecord {
  return {
    id: id(),
    name,
    factionId,
    role,
    baseMm,
    baseShape: 'circle',
    baseW: baseMm,
    baseH: baseMm,
    background: SAMPLE,
    profiles,
    weapons,
    abilities,
    keywords,
    leads: [],
  };
}

const datasheets: DatasheetRecord[] = [
  // ---------- Necrons ----------
  ds('Overlord', 'NEC', 'Character', 40,
    [p('Overlord', 5, 5, '3+', 5, '6+', 1, '4+')],
    [rw('Tachyon arrow', '48"', '1', '2+', '16', '-5', '6', 'One Shot, Devastating Wounds'),
     mw("Overlord's blade", '5', '2+', '7', '-2', '2')],
    [ab('My Will Be Done'), ab('Reanimation Protocols')],
    ['Character', 'Infantry', 'Necron', 'Overlord']),

  ds('Necron Warriors', 'NEC', 'Battleline', 32,
    [p('Necron Warrior', 5, 4, '4+', 1, '7+', 2)],
    [rw('Gauss reaper', '12"', '1', '4+', '5', '-2', '1', 'Lethal Hits'),
     rw('Gauss flayer', '24"', '1', '4+', '4', '-1', '1', 'Lethal Hits'),
     mw('Close combat weapon', '1', '4+', '4', '0', '1')],
    [ab('Reanimation Protocols')],
    ['Battleline', 'Infantry', 'Necron']),

  ds('Canoptek Doomstalker', 'NEC', 'Other', 90,
    [p('Canoptek Doomstalker', 6, 9, '3+', 10, '7+', 3)],
    [rw('Doomsday blaster', '48"', 'D6+1', '3+', '12', '-3', 'D6', 'Heavy'),
     mw('Automaton limbs', '3', '4+', '7', '-1', '1')],
    [ab('Reanimation Protocols'), ab('Combat Array')],
    ['Vehicle', 'Canoptek', 'Necron']),

  ds('Immortals', 'NEC', 'Other', 32,
    [p('Immortal', 5, 5, '3+', 2, '7+', 1)],
    [rw('Gauss blaster', '24"', '2', '4+', '5', '-2', '1', 'Lethal Hits'),
     mw('Close combat weapon', '1', '4+', '4', '0', '1')],
    [ab('Reanimation Protocols')],
    ['Infantry', 'Necron']),

  ds('Canoptek Scarab Swarms', 'NEC', 'Other', 40,
    [p('Canoptek Scarab Swarm', 10, 3, '6+', 4, '7+', 0)],
    [mw('Feeder mandibles', '4', '5+', '3', '0', '1')],
    [ab('Swarming Engines')],
    ['Swarm', 'Canoptek', 'Necron']),

  // ---------- Orks ----------
  ds('Warboss', 'ORK', 'Character', 50,
    [p('Warboss', 6, 6, '4+', 6, '6+', 1, '4+')],
    [rw('Kombi-weapon', '24"', '4', '5+', '5', '-1', '1'),
     mw('Power klaw', '5', '3+', '9', '-2', '2')],
    [ab('Waaagh!'), ab("Da Biggest Boss")],
    ['Character', 'Infantry', 'Ork']),

  ds('Boyz', 'ORK', 'Battleline', 32,
    [p('Boy', 6, 5, '6+', 1, '6+', 2)],
    [rw('Shoota', '18"', '2', '5+', '4', '0', '1'),
     mw('Choppa', '3', '3+', '4', '-1', '1')],
    [ab('Waaagh!'), ab('Mob Rule')],
    ['Battleline', 'Infantry', 'Ork']),

  ds('Deff Dread', 'ORK', 'Other', 90,
    [p('Deff Dread', 8, 9, '3+', 9, '6+', 2)],
    [rw('Big shoota', '36"', '3', '5+', '5', '0', '1'),
     mw('Dread klaw', '6', '4+', '10', '-2', '3')],
    [ab('Waaagh!'), ab('Lots of Klaws')],
    ['Vehicle', 'Walker', 'Ork']),

  // ---------- Tyranids ----------
  ds('Hive Tyrant', 'TYR', 'Character', 80,
    [p('Hive Tyrant', 8, 9, '2+', 10, '6+', 3, '4+')],
    [rw('Heavy venom cannon', '36"', 'D3', '3+', '9', '-2', '3', 'Blast'),
     mw('Monstrous scything talons', '6', '2+', '9', '-2', '3', 'Twin-linked')],
    [ab('Shadow in the Warp'), ab('Synapse')],
    ['Character', 'Monster', 'Tyranids']),

  ds('Termagants', 'TYR', 'Battleline', 28,
    [p('Termagant', 6, 3, '5+', 1, '8+', 2)],
    [rw('Fleshborer', '18"', '1', '4+', '5', '0', '1', 'Assault'),
     mw('Chitinous claws and teeth', '1', '5+', '3', '0', '1')],
    [ab('Synapse')],
    ['Battleline', 'Infantry', 'Tyranids']),

  ds('Termagant Brood', 'TYR', 'Battleline', 28,
    [p('Termagant', 6, 3, '5+', 1, '8+', 2)],
    [rw('Fleshborer', '18"', '1', '4+', '5', '0', '1', 'Assault'),
     mw('Chitinous claws and teeth', '1', '5+', '3', '0', '1')],
    [ab('Synapse')],
    ['Battleline', 'Infantry', 'Tyranids']),

  // ---------- T'au Empire ----------
  ds('Commander in Crisis Battlesuit', 'TAU', 'Character', 50,
    [p('Commander', 10, 5, '3+', 6, '7+', 1, '4+')],
    [rw('Cyclic ion blaster', '18"', '3', '4+', '7', '-1', '2', 'Hazardous'),
     mw('Battlesuit fists', '3', '5+', '6', '0', '1')],
    [ab('For the Greater Good'), ab('Manta Strike')],
    ['Character', 'Battlesuit', "T'au"]),

  ds('Strike Team', 'TAU', 'Battleline', 28,
    [p('Fire Warrior', 6, 3, '4+', 1, '7+', 2)],
    [rw('Pulse rifle', '30"', '1', '4+', '5', '0', '1', 'Rapid Fire 1'),
     mw('Close combat weapon', '1', '5+', '3', '0', '1')],
    [ab('For the Greater Good')],
    ['Battleline', 'Infantry', "T'au"]),

  // ---------- Aeldari ----------
  ds('Farseer', 'AE', 'Character', 32,
    [p('Farseer', 7, 3, '4+', 4, '6+', 1, '4+')],
    [rw('Shuriken pistol', '12"', '1', '2+', '4', '-1', '1', 'Pistol'),
     mw('Witchblade', '4', '2+', '4', '-1', 'D3')],
    [ab('Runes of Fate'), ab('Fate Dice')],
    ['Character', 'Psyker', 'Aeldari']),

  ds('Guardian Defenders', 'AE', 'Battleline', 28,
    [p('Guardian Defender', 7, 3, '4+', 1, '7+', 2)],
    [rw('Shuriken catapult', '18"', '2', '3+', '4', '-1', '1', 'Assault'),
     mw('Close combat weapon', '1', '4+', '3', '0', '1')],
    [ab('Ancient Doom')],
    ['Battleline', 'Infantry', 'Aeldari']),
];

console.log(`[seed] building SAMPLE database: ${factions.length} factions, ${datasheets.length} datasheets`);
buildDatabase(factions, datasheets);
console.log('[seed] done. This is placeholder data — run "npm run ingest" with Wahapedia CSVs for real stats.');
