export const CARD_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export const CARD_SUITS = ['s', 'h', 'd', 'c'] as const;

export type CardRank = (typeof CARD_RANKS)[number];
export type CardSuit = (typeof CARD_SUITS)[number];
/** Two characters: rank then suit, e.g. «As», «Td», «2c». */
export type CardCode = `${CardRank}${CardSuit}`;

export type HandOfDay = {
  /** Shown on the timer only while this is on. */
  on: boolean;
  /** Up to two distinct cards. */
  cards: CardCode[];
};

const RANK_SET = new Set<string>(CARD_RANKS);
const SUIT_SET = new Set<string>(CARD_SUITS);

export function isCardCode(value: unknown): value is CardCode {
  return typeof value === 'string' && value.length === 2 && RANK_SET.has(value[0]!) && SUIT_SET.has(value[1]!);
}

export function parseCard(code: string): { rank: CardRank; suit: CardSuit } | null {
  if (!isCardCode(code)) return null;
  return { rank: code[0] as CardRank, suit: code[1] as CardSuit };
}

export function cardCode(rank: CardRank, suit: CardSuit): CardCode {
  return `${rank}${suit}` as CardCode;
}

/** Ten is written «10» on the card, not «T». */
export function rankLabel(rank: CardRank): string {
  return rank === 'T' ? '10' : rank;
}

const RANK_NAMES: Record<CardRank, string> = {
  A: 'Туз',
  K: 'Король',
  Q: 'Дама',
  J: 'Валет',
  T: '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
};

const SUIT_NAMES: Record<CardSuit, string> = {
  s: 'пик',
  h: 'червей',
  d: 'бубен',
  c: 'треф',
};

export function cardName(code: CardCode): string {
  const parsed = parseCard(code);
  return parsed ? `${RANK_NAMES[parsed.rank]} ${SUIT_NAMES[parsed.suit]}` : code;
}

/** Four-colour deck: the suits are told apart at a glance from across the room. */
export const SUIT_COLORS: Record<CardSuit, string> = {
  s: '#1F2A44',
  h: '#E0283A',
  d: '#1976D2',
  c: '#1E9E4A',
};

export function normalizeHandCards(raw: unknown): CardCode[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const cards: CardCode[] = [];
  for (const item of raw) {
    if (!isCardCode(item) || seen.has(item)) continue;
    seen.add(item);
    cards.push(item);
    if (cards.length === 2) break;
  }
  return cards;
}

/** Reads a stored hand. Anything else than an object means «not set». */
export function normalizeHandOfDay(raw: unknown): HandOfDay | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as { on?: unknown; cards?: unknown };
  return { on: row.on === true, cards: normalizeHandCards(row.cards) };
}

/** The timer shows a hand only when it is on and both cards are picked. */
export function visibleHand(hand: HandOfDay | undefined | null): [CardCode, CardCode] | null {
  if (!hand || !hand.on || hand.cards.length !== 2) return null;
  return [hand.cards[0]!, hand.cards[1]!];
}

/**
 * Tapping a card in the list. A picked card is removed; a new one fills a free
 * place, and with two already picked it replaces the one picked earlier.
 */
export function toggleHandCard(cards: readonly CardCode[], code: CardCode): CardCode[] {
  if (cards.includes(code)) return cards.filter((card) => card !== code);
  if (cards.length < 2) return [...cards, code];
  return [cards[1]!, code];
}
