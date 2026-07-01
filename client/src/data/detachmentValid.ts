// Allowlist of the real 11th-edition matched-play detachments per faction.
//
// The Wahapedia import also carries Boarding Actions detachments and stray
// artifacts (e.g. an "Army Rules" entry), which aren't standard detachments.
// When a faction appears here, the Detachments panel shows only these names;
// factions not listed fall back to showing everything from the import.
//
// Keys: lowercased faction name → the detachment names exactly as they appear
// in the import.
export const VALID_DETACHMENTS: Record<string, string[]> = {
  orks: [
    'War Horde',
    'Blitz Brigade',
    'Bully Boyz',
    'Da Big Hunt',
    'Dread Mob',
    'Freebooter Krew',
    'Green Tide',
    'Kult of Speed',
    'More Dakka!',
    'Speedwaaagh!',
    'Taktikal Brigade',
  ],
};

// Returns the lowercased allowlist set for a faction, or null if none is defined
// (meaning: don't filter).
export function validDetachmentSet(faction: string | undefined): Set<string> | null {
  if (!faction) return null;
  const list = VALID_DETACHMENTS[faction.toLowerCase()];
  return list ? new Set(list.map((n) => n.toLowerCase())) : null;
}
