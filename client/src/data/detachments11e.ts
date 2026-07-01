// 11th-edition detachment content (rules / stratagems / enhancements).
//
// The Wahapedia CSV import is 10th edition, so for detachments listed here we
// override it with current 11th-ed data. IMPORTANT: the effect text below is my
// own brief, plain-language summary of each ability's mechanics — NOT Games
// Workshop's rules wording. Names, CP costs, point costs and phases are factual.
// Source the facts from the official faction packs; keep the wording original.
//
// Coverage is incremental: a detachment only appears once its content is sourced
// and summarised. Costs left as '' are not yet known.

export interface Strat11e {
  name: string;
  cp: string; // e.g. "1"
  turn?: string; // "Your turn" / "Either player's turn" / "Opponent's turn"
  phase?: string; // e.g. "Shooting"
  type?: string; // e.g. "Battle Tactic"
  effect: string; // my own concise summary
}
export interface Enh11e {
  name: string;
  pts: string; // points cost, '' if unknown
  effect: string; // my own concise summary
}
export interface Detachment11e {
  rule: { name: string; effect: string };
  enhancements: Enh11e[];
  stratagems: Strat11e[];
  partial?: boolean; // true while not every stratagem/enhancement is filled in
}

export const DETACHMENTS_11E: Record<string, Record<string, Detachment11e>> = {
  orks: {
    'Blitz Brigade': {
      rule: {
        name: 'Eager for the Fight',
        effect: 'A unit that disembarked this turn can re-roll Advance and Charge rolls until the end of the turn.',
      },
      enhancements: [
        { name: 'Runnin’ Boots', pts: '10', effect: 'Infantry Character. +1 to the bearer’s unit’s Charge rolls in a turn it disembarked.' },
        { name: 'Blitzkaptin', pts: '25', effect: 'Character. Redeploy up to 3 Vehicle units at the start of the first battle round; may exceed the Strategic Reserves limit.' },
        { name: 'Supercharged Squig Oil', pts: '10', effect: 'Mek. Once per turn a chosen friendly Vehicle unit can re-roll Charge rolls until end of turn.' },
        { name: 'Tuff Git', pts: '5', effect: 'Infantry Character. The bearer’s unit is not Battle-shocked as a result of disembarking.' },
      ],
      stratagems: [
        { name: 'Armoured Duellists', cp: '1', turn: 'Your turn', phase: 'Shooting', effect: 'A Vehicle gets +1 to Hit and +1 to Wound against Monsters and Vehicles this phase.' },
        { name: 'Mekanised Brutality', cp: '1', turn: 'Your turn', phase: 'Movement', effect: 'A unit that disembarked from a Battlewagon, Kill Rig or Hunta Rig can still declare a charge this turn.' },
        { name: 'Run ’Em Down', cp: '1', turn: 'Your turn', phase: 'Movement', effect: 'Up to two Vehicle/Monster units that Advanced can still declare a charge this turn.' },
        { name: 'Yooz In Trouble Now', cp: '1', turn: 'Your turn', phase: 'Shooting', effect: 'An embarked unit disembarks and makes a move toward the nearest enemy unit.' },
        { name: 'Impervious', cp: '1', turn: "Opponent's turn", phase: 'Shooting', effect: 'A Vehicle subtracts 1 from incoming Wound rolls where the attack’s Strength beats its Toughness.' },
        { name: 'Mount Up, Ladz', cp: '1', turn: 'Your turn', phase: 'Fight', effect: 'An Infantry unit within 6" of a friendly Transport can embark within it.' },
      ],
    },
    'Bully Boyz': {
      rule: {
        name: 'Da Boss Is Watchin’',
        effect: 'You can call a Waaagh! a second time during the battle, but only Warboss, Nobz and Meganobz units benefit from it.',
      },
      enhancements: [
        { name: 'Big Gob', pts: '20', effect: 'Infantry Warboss. Enemy units in Engagement Range of the bearer take Battle-shock tests with -1.' },
        { name: 'Da Biggest Boss', pts: '15', effect: 'Infantry Warboss. +2 to the bearer’s Wounds characteristic.' },
        { name: '’Eadstompa', pts: '10', effect: 'Infantry Warboss. Re-roll Wound rolls of 1 against weakened units; re-roll all Wounds while the bearer’s unit is below half strength.' },
        { name: 'Tellyporta', pts: '25', effect: 'Warboss in Mega Armour. The bearer’s unit gains Deep Strike.' },
      ],
      stratagems: [
        { name: 'Hulking Brutes', cp: '1', turn: "Opponent's turn", phase: 'Shooting', effect: 'A Nobz or Meganobz unit gives attacks targeting it -1 AP.' },
        { name: 'Armed to Dateef', cp: '1', phase: 'Shooting / Fight', effect: 'A Nobz/Meganobz unit re-rolls Hit rolls of 1 — all Hit rolls while a Waaagh! is active.' },
        { name: 'Cut ’Em Down', cp: '1', turn: "Opponent's turn", phase: 'Movement', effect: 'When a unit Falls Back from a Nobz/Meganobz unit, it takes a Desperate Escape test, with -1 if a Waaagh! is active.' },
        { name: 'Crushing Impact', cp: '1', turn: 'Your turn', phase: 'Charge', effect: 'Roll a D6 per model in Engagement Range; each 5+ (4+ with Waaagh! active) deals a mortal wound, to a max of 6.' },
        { name: 'Too Arrogant to Die', cp: '1', phase: 'Shooting / Fight', effect: 'When a model is destroyed, roll a D6 (+2 if a Waaagh! is active); on 5+ it stays in play and can still shoot/fight.' },
        { name: 'Always Lookin’ Fer a Fight', cp: '1', turn: 'Your turn', phase: 'Fight', effect: 'Consolidation moves become D3+3" (6" while a Waaagh! is active).' },
      ],
    },
    'Dread Mob': {
      rule: {
        name: 'Try Dat Button!',
        effect: 'Each battle round, Mek/Walker/Grots-Vehicle units gain a random weapon ability (roll D6: 1-2 Sustained Hits 1, 3-4 Lethal Hits, 5-6 Critical Wound +2 AP). You may instead pick the ability, but their weapons then gain Hazardous. Gretchin units gain Battleline.',
      },
      enhancements: [
        { name: 'Gitfinder Googlez', pts: '10', effect: 'Mek. The bearer’s unit’s ranged weapons gain Ignores Cover.' },
        { name: 'Press It Fasta!', pts: '35', effect: 'Mek. Roll an extra D6 for the detachment button; the bearer’s ranged weapons gain both button effects.' },
        { name: 'Smoky Gubbinz', pts: '15', effect: 'Mek. The bearer’s unit gains Stealth.' },
        { name: 'Supa-glowy Fing', pts: '20', effect: 'Mek. Command phase: pick an enemy unit within 18" and roll a D6 — 1-2 it takes a Battle-shock test, 3-4 D3 mortal wounds, 5-6 -1 to its Hit rolls next turn.' },
      ],
      stratagems: [
        { name: 'Dakka! Dakka! Dakka!', cp: '1', turn: 'Your turn', phase: 'Shooting', effect: 'A Walker/Grots-Vehicle re-rolls Hit rolls of 1; the pushed version grants full re-rolls but Hazardous.' },
        { name: 'Bigger Shells for Bigger Gitz', cp: '1', turn: 'Your turn', phase: 'Shooting', effect: '+1 to Wound against Monsters/Vehicles; the pushed version adds +1 Damage but Hazardous.' },
        { name: 'Extra Gubbinz', cp: '1', turn: "Opponent's turn", phase: 'Shooting', effect: 'A non-Titanic Walker/Grots-Vehicle reduces incoming Damage by 1.' },
        { name: 'Klankin’ Klaws', cp: '1', turn: 'Your turn', phase: 'Fight', effect: 'A Walker’s melee weapons gain +2 Strength; the pushed version adds +1 Damage but Hazardous.' },
        { name: 'Conniving Runts', cp: '1', turn: "Opponent's turn", phase: 'Movement', effect: 'When an enemy moves within 9" of a Gretchin unit, roll a D6 — on 4+ it takes D3+1 mortal wounds, then the Gretchin move.' },
        { name: 'Superfuelled Boiler', cp: '1', turn: 'Your turn', phase: 'Movement', effect: 'A Walker that Advanced re-rolls the Advance and its ranged weapons gain Assault.' },
      ],
    },
    'War Horde': {
      rule: {
        name: 'Get Stuck In',
        effect: 'Melee weapons carried by Orks models gain [Sustained Hits 1].',
      },
      enhancements: [
        { name: 'Follow Me Ladz', pts: '25', effect: '+2" to the Move characteristic of the bearer’s unit.' },
        { name: 'Headwoppa’s Killchoppa', pts: '20', effect: 'The bearer’s melee weapons (except Extra Attacks weapons) gain [Devastating Wounds].' },
        { name: 'Kunnin’ But Brutal', pts: '15', effect: 'The bearer’s unit can shoot and declare a charge in a turn it Fell Back.' },
        { name: 'Supa-Cybork Body', pts: '15', effect: 'The bearer gains Feel No Pain 4+.' },
      ],
      stratagems: [
        { name: '’Ere We Go', cp: '1', turn: 'Your turn', phase: 'Movement', effect: 'An Orks Infantry unit gets +2 to Advance and Charge rolls this turn.' },
        { name: 'Mob Rule', cp: '1', turn: 'Your turn', phase: 'Command', effect: 'A Battle-shocked Orks Infantry unit within 6" of a friendly Mob unit (10+ models) stops being Battle-shocked.' },
        { name: '’Ard As Nails', cp: '1', phase: 'Shooting / Fight', effect: 'An Orks unit subtracts 1 from incoming Wound rolls this phase.' },
        { name: 'Unbridled Carnage', cp: '1', turn: 'Your turn', phase: 'Fight', effect: 'An Orks unit scores Critical Hits on unmodified 5+ in melee this phase.' },
        { name: 'Orks Is Never Beaten', cp: '2', phase: 'Fight', effect: 'Models destroyed in an Orks unit that hasn’t fought yet can still fight before being removed.' },
        { name: 'Careen!', cp: '1', phase: 'Any', effect: 'When an Orks Vehicle with Deadly Demise rolls a 6, it can make a Normal or Fall Back move before Deadly Demise resolves.' },
      ],
    },
    'Da Big Hunt': {
      rule: {
        name: 'Da Hunt Is On',
        effect: 'At the start of your Command phase, pick an enemy Monster/Vehicle/Character unit as Prey until your next Command phase. Beast Snagga units re-roll Charge rolls against the Prey, and their attacks against it gain +1 AP.',
      },
      enhancements: [
        { name: 'Glory Hog', pts: '30', effect: 'A Beastboss on Squigosaur’s unit gains Scouts 9".' },
        { name: 'Proper Killy', pts: '15', effect: '+1 Damage on the bearer’s melee weapons.' },
        { name: 'Skrag Every Stash!', pts: '25', effect: 'While the bearer is within range of an objective it controls, that objective stays yours with no models on it until the enemy takes it.' },
        { name: 'Surly as a Squiggoth', pts: '20', effect: 'Attacks whose Strength beats the bearer’s unit’s Toughness subtract 1 from their Wound rolls.' },
      ],
      stratagems: [
        { name: 'Stalkin’ Taktiks', cp: '1', turn: 'Opponent’s turn', phase: 'Shooting', effect: 'A Beast Snagga unit gains Benefit of Cover; Infantry also gain Stealth.' },
        { name: 'Drag It Down', cp: '1', turn: 'Your turn', phase: 'Fight', effect: 'A Beast Snagga unit’s melee weapons gain [Sustained Hits 1], and Critical Hits on 5+ against the Prey.' },
        { name: 'Dat One’s Even Bigga!', cp: '1', turn: 'Your turn', phase: 'Charge', effect: 'A Beast Snagga unit can charge after Advancing or Falling Back, and re-rolls Charge rolls against the Prey.' },
        { name: 'Instinctive Hunters', cp: '1', phase: 'Fight', effect: 'At the end of the Fight phase, a Beast Snagga unit not in Engagement Range goes into Strategic Reserves.' },
        { name: 'Where D’ya Fink You’re Going?', cp: '1', turn: 'Opponent’s turn', phase: 'Movement', effect: 'When an enemy Falls Back near a Beast Snagga unit within 6", that unit makes a Normal move.' },
        { name: 'Unstoppable Momentum', cp: '1', turn: 'Your turn', phase: 'Charge', effect: 'After a Mounted Beast Snagga charge, roll a D6 per model at a target — each 4+ deals 1 mortal wound (max 6); roll 3 extra dice if it is the Prey.' },
      ],
    },
    'Freebooter Krew': {
      rule: {
        name: 'Here Be Loot',
        effect: 'At the start of your Command phase, pick an objective as the loot objective until your next Command phase. Orks Infantry/Mounted/Walker units gain [Sustained Hits 1] while they or their target are within range of it.',
      },
      enhancements: [
        { name: 'Da Kaptin', pts: '10', effect: 'Warboss. Once per battle round, a Battle-shocked Orks unit within 12" takes D3 mortal wounds and stops being Battle-shocked.' },
        { name: 'Git-spotter Squig', pts: '20', effect: 'The bearer’s ranged weapons gain [Ignores Cover].' },
        { name: 'Bionik Workshop', pts: '15', effect: 'Big Mek or Painboy. Roll a D3 at the start of the battle: 1 = +2" Move, 2 = +1 melee Strength, 3 = +1 melee WS.' },
        { name: 'Razgit’s Magik Map', pts: '25', effect: 'Redeploy up to three Orks Infantry units after deployment; may exceed the Strategic Reserves limit.' },
      ],
      stratagems: [
        { name: 'Boardin’ Rush', cp: '1', turn: 'Your turn', phase: 'Movement', effect: 'An Orks unit adds 6" to its Move this phase (no Advance roll).' },
        { name: 'Bash and Grab', cp: '1', turn: 'Your turn', phase: 'Fight', effect: 'An Orks unit re-rolls Wound rolls against enemies within range of the loot objective.' },
        { name: 'Rolling Loot-heap', cp: '1', turn: 'Your turn', phase: 'Shooting', effect: 'A Flash Gitz unit’s weapons gain [Anti-Vehicle 4+] this phase.' },
        { name: 'Grab and Bash', cp: '1', turn: 'Your turn', phase: 'Command', effect: 'An Orks unit (not Gretchin) within range of the loot objective counts as having a Waaagh! active until your next Command phase.' },
        { name: 'Deck Fraggers', cp: '1', turn: 'Your turn', phase: 'Shooting', effect: 'An Orks unit’s ranged weapons gain [Blast] against Infantry this phase.' },
        { name: 'Krump and Run', cp: '1', turn: 'Your turn', phase: 'Movement', effect: 'An Orks unit in Engagement Range of an enemy that Fell Back makes a Normal move up to 6".' },
      ],
    },
    'Taktikal Brigade': {
      partial: true,
      rule: {
        name: "Lissen 'Ere",
        effect:
          'Stormboyz count as Battleline. Your Boyz, Kommandos and Stormboyz can still perform Actions in a turn they Advanced or Fell Back.',
      },
      enhancements: [
        {
          name: 'Slippery Git',
          pts: '',
          effect:
            'Infantry Warboss (not in Mega Armour) gains Infiltrators and Stealth.',
        },
      ],
      stratagems: [
        {
          name: 'Ded Sneaky',
          cp: '1',
          turn: "Opponent's turn",
          phase: 'Fight',
          effect:
            'At the end of the enemy Fight phase, pull one of your unengaged Kommandos or Stormboyz units into Strategic Reserves.',
        },
      ],
    },
    'More Dakka!': {
      rule: {
        name: 'Dakka! Dakka! Dakka!',
        effect:
          'Friendly Orks Infantry units’ ranged attacks gain [Assault]. In your Shooting phase, while your Waaagh! is active, they also gain [Sustained Hits 1].',
      },
      enhancements: [
        {
          name: 'Dead Shiny Shootas',
          pts: '',
          effect:
            "Orks Infantry unit only. Its ranged attacks gain [Rapid Fire 1] — or if they already have Rapid Fire, increase that value by 1.",
        },
        {
          name: 'Da Gobshot Thunderbuss',
          pts: '',
          effect:
            'Orks Infantry model only. Its ranged attacks gain [Devastating Wounds] and [Hazardous].',
        },
      ],
      stratagems: [
        {
          name: 'Long, Uncontrolled Bursts',
          cp: '1',
          turn: 'Your turn',
          phase: 'Shooting',
          effect:
            'When a friendly Orks Infantry unit is selected to shoot, its ranged attacks gain [Ignores Cover].',
        },
        {
          name: 'Speshul Shells',
          cp: '1',
          turn: 'Your turn',
          phase: 'Shooting',
          effect:
            'When a friendly Orks Infantry unit is selected to shoot, its ranged attacks have +1 AP against targets within 9".',
        },
        {
          name: 'Call Dat Dakka?',
          cp: '1',
          turn: "Opponent's turn",
          phase: 'Shooting',
          effect:
            'After an enemy unit that shot a friendly Orks Infantry unit finishes shooting, that unit shoots back using snap shooting, and may only target that enemy unit.',
        },
      ],
    },
  },
};

export function detachment11e(
  faction: string | undefined,
  name: string
): Detachment11e | undefined {
  if (!faction) return undefined;
  return DETACHMENTS_11E[faction.toLowerCase()]?.[name];
}
