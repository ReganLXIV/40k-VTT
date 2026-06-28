// User-editable detachment content, saved per browser (localStorage). This lets
// anyone bring a detachment up to 11th edition in-app — typing in their own
// rules from the faction pack — without code changes or re-ingesting. A user
// edit takes priority over the built-in 11th-ed override, which takes priority
// over the Wahapedia (10th-ed) import.
import type { DetachmentInfo } from '@shared/types';
import { detachment11e } from './detachments11e';
import { detachmentDP } from './detachmentPoints';

export interface NormStrat {
  name: string;
  cp: string;
  turn?: string;
  phase?: string;
  effect: string;
}
export interface NormEnh {
  name: string;
  pts: string;
  effect: string;
}
export interface NormDetachment {
  rule?: { name: string; effect: string };
  enhancements: NormEnh[];
  stratagems: NormStrat[];
}
export interface DetachmentEdit extends NormDetachment {
  dp?: number | null; // overrides the static DP table when set
}

export type DetSource = 'edited' | '11e' | 'wahapedia' | 'none';

const editKey = (f: string | undefined, n: string) => `vtt-det-edit-${(f || '').toLowerCase()}::${n}`;

export function loadEdit(faction: string | undefined, name: string): DetachmentEdit | null {
  try {
    const s = JSON.parse(localStorage.getItem(editKey(faction, name)) || 'null');
    if (s && Array.isArray(s.enhancements) && Array.isArray(s.stratagems)) return s as DetachmentEdit;
  } catch {
    /* ignore */
  }
  return null;
}
export function saveEdit(faction: string | undefined, name: string, e: DetachmentEdit) {
  try {
    localStorage.setItem(editKey(faction, name), JSON.stringify(e));
  } catch {
    /* ignore */
  }
}
export function clearEdit(faction: string | undefined, name: string) {
  try {
    localStorage.removeItem(editKey(faction, name));
  } catch {
    /* ignore */
  }
}

function fromApi(info: DetachmentInfo): NormDetachment {
  const a = info.abilities[0];
  return {
    rule: a ? { name: a.name, effect: a.description } : undefined,
    enhancements: info.enhancements.map((e) => ({ name: e.name, pts: e.cost, effect: e.description })),
    stratagems: info.stratagems.map((s) => ({
      name: s.name,
      cp: s.cpCost,
      turn: s.turn,
      phase: s.phase,
      effect: s.description,
    })),
  };
}

function from11e(faction: string | undefined, name: string): NormDetachment | null {
  const ov = detachment11e(faction, name);
  if (!ov) return null;
  return {
    rule: { name: ov.rule.name, effect: ov.rule.effect },
    enhancements: ov.enhancements.map((e) => ({ name: e.name, pts: e.pts, effect: e.effect })),
    stratagems: ov.stratagems.map((s) => ({
      name: s.name,
      cp: s.cp,
      turn: s.turn,
      phase: s.phase,
      effect: s.effect,
    })),
  };
}

// The content to display, resolving the edit → 11th-ed override → Wahapedia chain.
export function resolveDetachment(
  faction: string | undefined,
  name: string,
  apiInfo?: DetachmentInfo
): { source: DetSource; content: NormDetachment } {
  const edit = loadEdit(faction, name);
  if (edit) return { source: 'edited', content: edit };
  const ov = from11e(faction, name);
  if (ov) return { source: '11e', content: ov };
  if (apiInfo) return { source: 'wahapedia', content: fromApi(apiInfo) };
  return { source: 'none', content: { enhancements: [], stratagems: [] } };
}

// DP cost, honouring a user edit before the static table.
export function dpFor(faction: string | undefined, name: string): number | undefined {
  const edit = loadEdit(faction, name);
  if (edit && edit.dp != null) return edit.dp;
  return detachmentDP(faction, name);
}

// A starting point for the editor: the current edit if any, else the resolved
// content, plus the current DP.
export function seedEdit(
  faction: string | undefined,
  name: string,
  apiInfo?: DetachmentInfo
): DetachmentEdit {
  const existing = loadEdit(faction, name);
  if (existing) return existing;
  const { content } = resolveDetachment(faction, name, apiInfo);
  return {
    dp: detachmentDP(faction, name) ?? null,
    rule: content.rule ?? { name: '', effect: '' },
    enhancements: content.enhancements,
    stratagems: content.stratagems,
  };
}
