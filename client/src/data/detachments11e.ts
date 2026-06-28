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
