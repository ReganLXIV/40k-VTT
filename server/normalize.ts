// Name normalization used on BOTH the DB side (ingest) and the roster side
// (hydration) so the two can be compared. Keep this in one place so they never drift.

export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/\([^)]*\)/g, ' ') // remove trailing/parenthetical qualifiers
    .replace(/['’`]/g, '') // drop apostrophes (T'au -> tau)
    .replace(/[^a-z0-9 ]+/g, ' ') // strip remaining punctuation
    .replace(/\b(squad|the)\b/g, ' ') // remove filler words
    .replace(/\s+/g, ' ')
    .trim();
}
