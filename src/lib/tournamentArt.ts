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

export function tournamentArtClassName(id: string): string {
  return `${BASE} ${FIT_BY_ID[id] ?? DEFAULT_FIT}`;
}

export const TOURNAMENT_ART_MASK = {
  WebkitMaskImage: 'linear-gradient(to right, transparent, black 45%)',
  maskImage: 'linear-gradient(to right, transparent, black 45%)',
} as const;

export const TOURNAMENT_ART_FADE = {
  background:
    'linear-gradient(to right, #1d0b07 0%, #1d0b07 28%, rgba(29,11,7,0.55) 42%, transparent 55%)',
} as const;
