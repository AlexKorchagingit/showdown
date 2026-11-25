export const EVENT_FORMATS = ['regular', 'knockout', 'freeroll', 'team'] as const;

export type EventFormat = (typeof EVENT_FORMATS)[number];

export const EVENT_FORMAT_LABEL: Record<EventFormat, string> = {
  regular: 'Обычный',
  knockout: 'Нокаут',
  freeroll: 'Freeroll',
  team: 'Team Battle',
};

export function isEventFormat(value: unknown): value is EventFormat {
  return value === 'regular' || value === 'knockout' || value === 'freeroll' || value === 'team';
}

type FormatSource = {
  eventFormat?: string | null;
  isBounty?: boolean;
  title?: string;
  blindStructure?: string;
};

/** Saved choice wins. Older nights are read from the bounty flag and the title. */
export function eventFormatOf(tournament: FormatSource | null | undefined): EventFormat {
  if (!tournament) return 'regular';
  if (isEventFormat(tournament.eventFormat)) return tournament.eventFormat;
  const text = `${tournament.title ?? ''} ${tournament.blindStructure ?? ''}`;
  if (/team battle/i.test(text)) return 'team';
  if (tournament.isBounty === true) return 'knockout';
  if (/freeroll/i.test(text)) return 'freeroll';
  if (/bounty/i.test(text)) return 'knockout';
  return 'regular';
}

export function isFreerollEvent(tournament: FormatSource | null | undefined): boolean {
  return eventFormatOf(tournament) === 'freeroll';
}

export function isKnockoutFormat(tournament: FormatSource | null | undefined): boolean {
  return eventFormatOf(tournament) === 'knockout';
}
