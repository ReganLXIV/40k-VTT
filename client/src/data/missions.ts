// Mission reference for the current (11th edition, Chapter Approved) matched-play deck.
//
// IMPORTANT: these are short, ORIGINAL functional reminders written for this app
// — NOT reproductions of Games Workshop's printed card text or artwork. Card
// names and victory-point values are factual references. Always use your own
// official mission cards for the exact rules and wording.

export interface MissionCard {
  id: string;
  name: string;
  vp: string; // factual VP value(s), e.g. "Up to 15" / "5"
  summary: string; // our own brief paraphrase of what the card asks you to do
}

// ---- Primary missions (one is in play for the whole game; shared selection) ----
export const PRIMARY_MISSIONS: MissionCard[] = [
  { id: 'take_and_hold', name: 'Take and Hold', vp: 'Up to 45',
    summary: 'Hold objective markers. Score each of your command phases (and at the end) for the objectives you control.' },
  { id: 'purge_the_foe', name: 'Purge the Foe', vp: 'Up to 45',
    summary: 'Score for objectives you control, with extra value for objectives outside your own half.' },
  { id: 'scorched_earth', name: 'Scorched Earth', vp: 'Up to 45',
    summary: 'Hold objectives; later you can perform an action to “burn” certain objectives for a one-off bonus, removing them.' },
  { id: 'the_ritual', name: 'The Ritual', vp: 'Up to 45',
    summary: 'Extra objective markers appear over the early rounds; score for holding the active set each round.' },
  { id: 'linchpin', name: 'Linchpin', vp: 'Up to 45',
    summary: 'Hold objectives, with the central objective worth more than the others.' },
  { id: 'supply_drop', name: 'Supply Drop', vp: 'Up to 45',
    summary: 'Only a rotating subset of objectives is active each round — hold the active ones to score.' },
  { id: 'terraform', name: 'Terraform', vp: 'Up to 45',
    summary: 'Hold objectives and perform actions to “terraform” them for escalating value as the game goes on.' },
  { id: 'burden_of_trust', name: 'Burden of Trust', vp: 'Up to 45',
    summary: 'Hold objectives including a nominated “trusted” objective that must stay under your control to score fully.' },
];

// ---- Secondary objectives: Tactical deck (draw from this each turn) ----
export const SECONDARY_CARDS: MissionCard[] = [
  { id: 'engage_on_all_fronts', name: 'Engage on All Fronts', vp: 'Up to 5',
    summary: 'Have qualifying units spread across multiple table quarters / far from your board edges.' },
  { id: 'bring_it_down', name: 'Bring It Down', vp: 'Up to 6',
    summary: 'Destroy enemy MONSTER and VEHICLE units; bigger targets are worth more.' },
  { id: 'assassination', name: 'Assassination', vp: 'Up to 5',
    summary: 'Destroy enemy CHARACTER units.' },
  { id: 'behind_enemy_lines', name: 'Behind Enemy Lines', vp: 'Up to 4',
    summary: 'Have units wholly within the opponent’s deployment zone.' },
  { id: 'cleanse', name: 'Cleanse', vp: 'Up to 4',
    summary: 'Perform an action to “cleanse” objective markers you control in no-man’s-land.' },
  { id: 'storm_hostile_objective', name: 'Storm Hostile Objective', vp: 'Up to 5',
    summary: 'Take and hold an objective in the enemy’s half of the board.' },
  { id: 'area_denial', name: 'Area Denial', vp: '5',
    summary: 'Control the area around the centre of the battlefield with no enemies contesting it.' },
  { id: 'defend_stronghold', name: 'Defend Stronghold', vp: '5',
    summary: 'Keep control of the objective in your own deployment zone.' },
  { id: 'sabotage', name: 'Sabotage', vp: 'Up to 6',
    summary: 'Perform a sabotage action on terrain features in or near the enemy half.' },
  { id: 'containment', name: 'Containment', vp: 'Up to 4',
    summary: 'Have units near the enemy’s board edges to pin them in.' },
  { id: 'recover_assets', name: 'Recover Assets', vp: 'Up to 5',
    summary: 'Perform actions on objective markers to recover battlefield assets.' },
  { id: 'extend_battle_lines', name: 'Extend Battle Lines', vp: '5',
    summary: 'Control objectives in no-man’s-land in both your own and the enemy half.' },
  { id: 'overwhelming_force', name: 'Overwhelming Force', vp: 'Up to 5',
    summary: 'Destroy enemy units while you control an objective marker.' },
  { id: 'no_prisoners', name: 'No Prisoners', vp: 'Up to 5',
    summary: 'Destroy enemy units; score scales with how many you wipe out this turn.' },
  { id: 'marked_for_death', name: 'Marked for Death', vp: 'Up to 5',
    summary: 'Destroy specific enemy units nominated when the card is drawn.' },
  { id: 'a_tempting_target', name: 'A Tempting Target', vp: '5',
    summary: 'Control a single objective marker nominated at random when drawn.' },
  { id: 'cull_the_horde', name: 'Cull the Horde', vp: 'Up to 5',
    summary: 'Destroy enemy units that contain large numbers of models.' },
  { id: 'establish_locus', name: 'Establish Locus', vp: 'Up to 4',
    summary: 'Perform an action with a unit near the centre or in the enemy half.' },
  { id: 'investigate_signals', name: 'Investigate Signals', vp: 'Up to 5',
    summary: 'Perform investigate actions at objective markers across the board.' },
  { id: 'secure_no_mans_land', name: "Secure No Man's Land", vp: 'Up to 5',
    summary: 'Control objective markers in no-man’s-land.' },
];

export const PRIMARY_BY_ID: Record<string, MissionCard> = Object.fromEntries(
  PRIMARY_MISSIONS.map((m) => [m.id, m])
);
export const SECONDARY_BY_ID: Record<string, MissionCard> = Object.fromEntries(
  SECONDARY_CARDS.map((m) => [m.id, m])
);
