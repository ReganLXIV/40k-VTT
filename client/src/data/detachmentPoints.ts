// Detachment Points (DP) cost per detachment — 11th edition.
//
// Budget: 2 DP at ~1000 pts (Incursion), 3 at ~2000 (Strike Force). Each
// detachment costs 1–3 DP and no two detachments may share a keyword.
//
// These are maintained by hand from the official faction packs — the values
// aren't in the Wahapedia CSV import, so this file is the source of truth.
// Edit/extend freely. Keys: lowercased faction name → detachment name (exactly
// as it appears in the detachment list) → DP cost. A detachment with no entry
// shows "?" in the UI (cost not yet set) and counts as 0 toward the budget.
export const DETACHMENT_DP: Record<string, Record<string, number>> = {
  // Orks — DP costs from the official Warhammer Community 11th-ed Xenos faction
  // pack article. (Rollin' Deff, 1 DP, also exists but isn't in this DB's list.)
  // Kaptin Killers and Ramship Raiders aren't in the core faction pack, so their
  // DP is unknown here and shows "?".
  orks: {
    'War Horde': 3,
    'Blitz Brigade': 2,
    'Bully Boyz': 2,
    'Da Big Hunt': 2,
    'Dread Mob': 2,
    'Freebooter Krew': 2,
    'Green Tide': 2,
    'Kult of Speed': 2,
    'Speedwaaagh!': 2,
    'More Dakka!': 1,
    'Taktikal Brigade': 1,
  },
};

// DP cost for a detachment, or undefined if not yet recorded.
export function detachmentDP(faction: string | undefined, name: string): number | undefined {
  if (!faction) return undefined;
  return DETACHMENT_DP[faction.toLowerCase()]?.[name];
}
