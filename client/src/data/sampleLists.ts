// Ready-made ~1000-point sample armies for quick testing / demos. Unit header
// names match datasheets in the stat DB so they hydrate cleanly. Points are
// indicative labels only (the app doesn't validate list legality).

export interface SampleList {
  id: string;
  label: string; // shown in the picker
  text: string; // New Recruit-style plain text fed to /api/parse-army
}

export const SAMPLE_LISTS: SampleList[] = [
  {
    id: 'necrons',
    label: 'Necrons — Awakened Dynasty (1000)',
    text: `Sample Necron Army (1000 Points)

Xenos - Necrons
Strike Force (1000 Points)
Awakened Dynasty

CHARACTERS

Overlord (110 Points)
  • 1x Overlord

Technomancer (75 Points)
  • 1x Technomancer

BATTLELINE

Necron Warriors (200 Points)
  • 20x Necron Warrior

OTHER DATASHEETS

Immortals (140 Points)
  • 10x Immortal

Lokhust Heavy Destroyers (50 Points)
  • 1x Lokhust Heavy Destroyer

Canoptek Doomstalker (140 Points)
  • 1x Canoptek Doomstalker

Canoptek Scarab Swarms (40 Points)
  • 3x Canoptek Scarab Swarm

Doomsday Ark (200 Points)
  • 1x Doomsday Ark`,
  },
  {
    id: 'space_marines',
    label: 'Space Marines — Gladius (1000)',
    text: `Sample Space Marine Army (1000 Points)

Imperium - Space Marines
Strike Force (1000 Points)
Gladius Task Force

CHARACTERS

Captain In Gravis Armour (80 Points)
  • 1x Captain in Gravis Armour

Librarian (65 Points)
  • 1x Librarian

BATTLELINE

Intercessor Squad (80 Points)
  • 5x Intercessor

Assault Intercessor Squad (75 Points)
  • 5x Assault Intercessor

OTHER DATASHEETS

Hellblaster Squad (115 Points)
  • 5x Hellblaster

Terminator Squad (170 Points)
  • 5x Terminator

Redemptor Dreadnought (210 Points)
  • 1x Redemptor Dreadnought

Repulsor (180 Points)
  • 1x Repulsor`,
  },
  {
    id: 'orks',
    label: 'Orks — War Horde (1000)',
    text: `Sample Ork Army (1000 Points)

Xenos - Orks
Strike Force (1000 Points)
War Horde

CHARACTERS

Warboss (80 Points)
  • 1x Warboss

Beastboss (80 Points)
  • 1x Beastboss

BATTLELINE

Boyz (170 Points)
  • 20x Boy

OTHER DATASHEETS

Nobz (160 Points)
  • 10x Nob

Meganobz (170 Points)
  • 5x Meganob

Deff Dread (130 Points)
  • 1x Deff Dread

Killa Kans (135 Points)
  • 3x Killa Kan

Trukk (65 Points)
  • 1x Trukk`,
  },
  {
    id: 'tyranids',
    label: 'Tyranids — Invasion Fleet (1000)',
    text: `Sample Tyranid Army (1000 Points)

Xenos - Tyranids
Strike Force (1000 Points)
Invasion Fleet

CHARACTERS

Hive Tyrant (135 Points)
  • 1x Hive Tyrant

Broodlord (85 Points)
  • 1x Broodlord

BATTLELINE

Termagants (150 Points)
  • 20x Termagant

Hormagaunts (130 Points)
  • 20x Hormagaunt

OTHER DATASHEETS

Genestealers (140 Points)
  • 10x Genestealer

Zoanthropes (110 Points)
  • 3x Zoanthrope

Carnifexes (115 Points)
  • 1x Carnifex

Tyranid Warriors With Melee Bio-weapons (90 Points)
  • 3x Tyranid Warrior`,
  },
  {
    id: 'astra_militarum',
    label: 'Astra Militarum — Combined Regiment (1000)',
    text: `Sample Astra Militarum Army (1000 Points)

Imperium - Astra Militarum
Strike Force (1000 Points)
Combined Regiment

CHARACTERS

Cadian Castellan (60 Points)
  • 1x Cadian Castellan

Lord Solar Leontus (130 Points)
  • 1x Lord Solar Leontus

BATTLELINE

Cadian Shock Troops (65 Points)
  • 10x Cadian Shock Trooper

Cadian Shock Troops (65 Points)
  • 10x Cadian Shock Trooper

OTHER DATASHEETS

Kasrkin (105 Points)
  • 10x Kasrkin

Field Ordnance Battery (105 Points)
  • 1x Field Ordnance Battery

Leman Russ Battle Tank (170 Points)
  • 1x Leman Russ Battle Tank

Rogal Dorn Battle Tank (220 Points)
  • 1x Rogal Dorn Battle Tank

Chimera (70 Points)
  • 1x Chimera`,
  },
  {
    id: 'tau',
    label: 'T’au Empire — Kauyon (1000)',
    text: `Sample T'au Army (1000 Points)

Xenos - T’au Empire
Strike Force (1000 Points)
Kauyon

CHARACTERS

Commander In Crisis Battlesuit (100 Points)
  • 1x Commander in Crisis Battlesuit

Cadre Fireblade (50 Points)
  • 1x Cadre Fireblade

BATTLELINE

Strike Team (75 Points)
  • 10x Fire Warrior

Breacher Team (90 Points)
  • 10x Fire Warrior

OTHER DATASHEETS

Crisis Fireknife Battlesuits (130 Points)
  • 3x Crisis Fireknife Battlesuit

Crisis Starscythe Battlesuits (110 Points)
  • 3x Crisis Starscythe Battlesuit

Pathfinder Team (90 Points)
  • 10x Pathfinder

Hammerhead Gunship (135 Points)
  • 1x Hammerhead Gunship

Riptide Battlesuit (180 Points)
  • 1x Riptide Battlesuit`,
  },
  {
    id: 'custodes',
    label: 'Adeptus Custodes — Shield Host (1000)',
    text: `Sample Custodes Army (1000 Points)

Imperium - Adeptus Custodes
Strike Force (1000 Points)
Shield Host

CHARACTERS

Shield-captain (130 Points)
  • 1x Shield-captain

Blade Champion (130 Points)
  • 1x Blade Champion

BATTLELINE

Custodian Guard (225 Points)
  • 5x Custodian Guard

OTHER DATASHEETS

Custodian Wardens (250 Points)
  • 5x Custodian Warden

Allarus Custodians (180 Points)
  • 3x Allarus Custodian

Vertus Praetors (165 Points)
  • 3x Vertus Praetor`,
  },
  {
    id: 'csm',
    label: 'Chaos Space Marines — Slaves to Darkness (1000)',
    text: `Sample Chaos Space Marine Army (1000 Points)

Chaos - Chaos Space Marines
Strike Force (1000 Points)
Slaves to Darkness

CHARACTERS

Chaos Lord (80 Points)
  • 1x Chaos Lord

Master Of Possession (90 Points)
  • 1x Master of Possession

BATTLELINE

Legionaries (140 Points)
  • 10x Legionary

Legionaries (70 Points)
  • 5x Legionary

Khorne Berzerkers (180 Points)
  • 10x Khorne Berzerker

OTHER DATASHEETS

Chaos Terminator Squad (180 Points)
  • 5x Chaos Terminator

Helbrute (130 Points)
  • 1x Helbrute

Chaos Rhino (75 Points)
  • 1x Chaos Rhino`,
  },
  {
    id: 'aeldari',
    label: 'Aeldari — Battle Host (1000)',
    text: `Sample Aeldari Army (1000 Points)

Xenos - Aeldari
Strike Force (1000 Points)
Battle Host

CHARACTERS

Farseer (70 Points)
  • 1x Farseer

Autarch (75 Points)
  • 1x Autarch

BATTLELINE

Guardian Defenders (100 Points)
  • 10x Guardian Defender

Storm Guardians (100 Points)
  • 10x Storm Guardian

OTHER DATASHEETS

Dire Avengers (110 Points)
  • 10x Dire Avenger

Howling Banshees (95 Points)
  • 5x Howling Banshee

Fire Dragons (115 Points)
  • 5x Fire Dragon

Wraithguard (170 Points)
  • 5x Wraithguard

Wave Serpent (120 Points)
  • 1x Wave Serpent`,
  },
];
