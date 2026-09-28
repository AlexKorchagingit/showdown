const BASE =
  'absolute top-1/2 -translate-y-1/2 w-auto max-w-none object-right object-contain pointer-events-none select-none origin-right bg-transparent border-0 shadow-none ring-0 outline-none';

const DEFAULT_FIT = 'right-[-5%] h-[120%] scale-75';

/** Per-tournament nudges for list cards and lobby heroes. */
const FIT_BY_ID: Record<string, string> = {
  opening: 'right-[-5%] h-[132%] scale-[0.86]',
  'triple-life': 'right-[-12%] h-[120%] scale-75',
  phoenix: 'right-[-3%] h-[132%] scale-[0.86]',
  freezeout: 'right-[-3%] h-[132%] scale-[0.86]',
  'bounty-hunter': 'right-[-3%] h-[132%] scale-[0.86]',
};

/** Bundled catalog art lives under `/tournaments/*.webp` (also `/showdown/` on Pages). */
const CATALOG_ART_PATH = /(?:^|\/)tournaments\/[^/?#]+\.(?:webp|png|jpe?g)$/i;

export function tournamentArtClassName(id: string): string {
  return `${BASE} ${FIT_BY_ID[id] ?? DEFAULT_FIT}`;
}

export const CUSTOM_TOURNAMENT_ART_CLASS =
  'absolute inset-0 w-full h-full object-cover pointer-events-none select-none bg-transparent border-0 shadow-none ring-0 outline-none';

export const TOURNAMENT_ART_MASK = {
  WebkitMaskImage: 'linear-gradient(to right, transparent, black 45%)',
  maskImage: 'linear-gradient(to right, transparent, black 45%)',
} as const;

export const TOURNAMENT_ART_FADE = {
  background:
    'linear-gradient(to right, #1d0b07 0%, #1d0b07 28%, rgba(29,11,7,0.55) 42%, transparent 55%)',
} as const;

export const CATALOG_TOURNAMENT_ART_STYLE = {
  opacity: 0.85,
  filter: 'brightness(1.08) contrast(1.04) saturate(1.04)',
  border: 'none',
  outline: 'none',
  boxShadow: 'none',
  background: 'transparent',
  ...TOURNAMENT_ART_MASK,
} as const;

export const CUSTOM_TOURNAMENT_ART_STYLE = {
  opacity: 0.72,
  border: 'none',
  outline: 'none',
  boxShadow: 'none',
  background: 'transparent',
  ...TOURNAMENT_ART_MASK,
} as const;

function catalogPathFromUrl(imageUrl: string): string {
  const trimmed = imageUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return trimmed;
    }
  }
  const q = trimmed.indexOf('?');
  const h = trimmed.indexOf('#');
  const cut = Math.min(q === -1 ? trimmed.length : q, h === -1 ? trimmed.length : h);
  return trimmed.slice(0, cut);
}

/** True for uploaded photos (data/blob/https) rather than bundled catalog WEBPs. */
export function isCustomTournamentArt(imageUrl: string): boolean {
  const url = imageUrl.trim();
  if (!url) return false;
  if (url.startsWith('data:') || url.startsWith('blob:')) return true;
  return !CATALOG_ART_PATH.test(catalogPathFromUrl(url));
}
