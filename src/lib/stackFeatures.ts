const START_LINE = /^Стартовый стек:\s*([\d\s\u00a0]+)$/i;
const REBUY_LINE = /^Стек ребая:\s*([\d\s\u00a0]+)$/i;
const ADDON_LINE = /^Стек аддона:\s*([\d\s\u00a0]+)$/i;
const LEGACY_START = /(?:начальн|стартов)[а-яё]*\s+стек/i;
const REBUY_OR_ADDON = /ре-?ба[а-яё]*|re[-\\s]?buy|р[еэ]-?энтри|адд?он|add[-\\s]?on/i;

function digits(value: string): number | null {
  const n = Number(value.replace(/[\s\u00a0]/g, ''));
  if (!Number.isInteger(n) || n < 1000 || n > 2_000_000_000) return null;
  return n;
}

/** A typed stack. Incomplete numbers (while the admin is still typing) are null. */
export function parseStackAmount(raw: string): number | null {
  return digits(raw.replace(/[^\d\s\u00a0]/g, ''));
}

export function parseStackFeatureLine(line: string): { kind: 'start' | 'rebuy' | 'addon'; amount: number } | null {
  const start = START_LINE.exec(line.trim());
  if (start) {
    const amount = digits(start[1] ?? '');
    return amount === null ? null : { kind: 'start', amount };
  }
  const rebuy = REBUY_LINE.exec(line.trim());
  if (rebuy) {
    const amount = digits(rebuy[1] ?? '');
    return amount === null ? null : { kind: 'rebuy', amount };
  }
  const addon = ADDON_LINE.exec(line.trim());
  if (addon) {
    const amount = digits(addon[1] ?? '');
    return amount === null ? null : { kind: 'addon', amount };
  }
  return null;
}

export function isLegacyStartingStackLine(line: string): boolean {
  return LEGACY_START.test(line) && !REBUY_OR_ADDON.test(line);
}

function grouped(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatStackFeature(kind: 'start' | 'rebuy' | 'addon', amount: number): string {
  const label = kind === 'start' ? 'Стартовый стек' : kind === 'rebuy' ? 'Стек ребая' : 'Стек аддона';
  return `${label}: ${grouped(amount)}`;
}

export type StackDraft = {
  starting: number | null;
  /** Null means the rebuy brings the same number of chips as the entry. */
  rebuy: number | null;
  /** Null hides the addon line. */
  addon: number | null;
};

export function stackDraftFromFeatures(features: string[], fallbackStart = 0): StackDraft {
  let starting: number | null = null;
  let rebuy: number | null = null;
  let addon: number | null = null;
  for (const line of features) {
    const parsed = parseStackFeatureLine(line);
    if (!parsed) continue;
    if (parsed.kind === 'start') starting = parsed.amount;
    if (parsed.kind === 'rebuy') rebuy = parsed.amount;
    if (parsed.kind === 'addon') addon = parsed.amount;
  }
  return { starting: starting ?? (fallbackStart > 0 ? fallbackStart : null), rebuy, addon };
}

/** Rewrite the three stack lines. Other feature bullets stay. */
export function featuresWithStackDraft(features: string[], draft: StackDraft): string[] {
  const rest = features.filter((line) => !parseStackFeatureLine(line) && !isLegacyStartingStackLine(line));
  const lines: string[] = [];
  if (draft.starting && draft.starting >= 1000) lines.push(formatStackFeature('start', draft.starting));
  if (
    draft.rebuy && draft.rebuy >= 1000 && draft.starting && draft.rebuy !== draft.starting
  ) {
    lines.push(formatStackFeature('rebuy', draft.rebuy));
  }
  if (draft.addon && draft.addon >= 1000) lines.push(formatStackFeature('addon', draft.addon));
  return [...lines, ...rest];
}
