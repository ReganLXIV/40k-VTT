/**
 * Approximate physical hull footprints for models that have no round/oval base
 * ("hull" / "unique" bases, or a big model on a small flying stem). Measured
 * from the physical GW model in mm [width, length] (1" = 25.4mm). Shared by both
 * ingest pipelines (Wahapedia CSV and the 40kdc JSON import) so vehicle sizes
 * stay consistent regardless of source.
 *
 * Multi-word / specific keys MUST come before generic ones (hullByName matches
 * the first substring hit), e.g. "land raider" before "raider".
 */
export const HULL: Record<string, [number, number]> = {
  // Orks
  battlewagon: [125, 240], gunwagon: [125, 240], bonebreaka: [125, 240],
  'kill rig': [120, 200], 'hunta rig': [120, 200], 'kill tank': [150, 300],
  'megatrakk scrapjet': [110, 180], 'kustom boosta': [110, 180],
  shokkjump: [110, 180], trukk: [105, 180], wartrakk: [95, 120],
  gorkanaut: [150, 160], morkanaut: [150, 160], stompa: [260, 260],
  // Necrons
  'doomsday ark': [90, 178], 'ghost ark': [90, 178],
  'annihilation barge': [80, 150], 'catacomb command barge': [80, 150],
  'triarch stalker': [152, 229], monolith: [152, 152],
  'gauss pylon': [140, 230], 'sentry pylon': [90, 140],
  // Aeldari grav-tanks (Falcon chassis) + super-heavies / flyers
  'fire prism': [95, 170], 'night spinner': [95, 170], 'wave serpent': [95, 170],
  'warp hunter': [95, 170], 'crimson hunter': [105, 180], falcon: [95, 170],
  firestorm: [95, 170], hemlock: [120, 200], nightwing: [105, 180],
  phoenix: [105, 180], cobra: [152, 305], lynx: [140, 260], scorpion: [152, 305],
  // Drukhari skimmers / flyers
  'land raider': [152, 229], raider: [64, 203], ravager: [64, 203],
  tantalus: [120, 260], razorwing: [105, 180], voidraven: [105, 180],
  // T'au skimmers / gunships
  hammerhead: [110, 180], devilfish: [110, 180], 'sky ray': [110, 180],
  razorshark: [120, 200], 'sun shark': [120, 200], 'tiger shark': [200, 300],
  // Leagues of Votann
  'hekaton land fortress': [120, 200], sagitaur: [90, 150],
  // Imperium / Chaos common chassis (Rhino, Predator, Land Raider, Russ, etc.)
  'leman russ': [152, 241], 'rogal dorn': [140, 250],
  predator: [120, 205], vindicator: [120, 205], whirlwind: [120, 190],
  razorback: [120, 190], rhino: [120, 190], repulsor: [140, 230],
  impulsor: [120, 200], gladiator: [140, 230], 'land speeder': [90, 150],
  chimera: [127, 190], hellhound: [127, 190], taurox: [100, 150],
  basilisk: [127, 230], manticore: [127, 200], wyvern: [127, 190],
  defiler: [152, 152], maulerfiend: [130, 165], forgefiend: [130, 165],
  'chaos land raider': [152, 229],
  baneblade: [178, 330], shadowsword: [178, 330], stormsword: [178, 330],
  stormlord: [178, 330], banehammer: [178, 330], banesword: [178, 330],
  doomhammer: [178, 330], hellhammer: [178, 330], stormblade: [178, 330],
};

export function hullByName(name: string): [number, number] | null {
  const n = name.toLowerCase();
  for (const k of Object.keys(HULL)) if (n.includes(k)) return HULL[k];
  return null;
}

// Fall back to a wounds-scaled rectangle when the model isn't in the table.
export function hullRect(name: string, wounds: number): [number, number] {
  const named = hullByName(name);
  if (named) return named;
  const w = wounds || 8;
  if (w <= 8) return [55, 90];
  if (w <= 12) return [80, 140];
  if (w <= 18) return [100, 180];
  if (w <= 24) return [120, 240];
  return [150, 300];
}
