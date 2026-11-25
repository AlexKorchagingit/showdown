import { PokerCard } from './PokerCard';
import {
  CARD_RANKS,
  CARD_SUITS,
  cardCode,
  cardName,
  normalizeHandCards,
  rankLabel,
  type CardCode,
  type CardRank,
  type CardSuit,
  type HandOfDay,
} from '../lib/pokerCards';

/** The two cards of the day, fanned like a hand, for the timer. */
export function HandOfDayCards({ cards, cardWidth = 88 }: { cards: [CardCode, CardCode]; cardWidth?: number }) {
  return (
    <div className="flex items-end justify-center" style={{ paddingTop: 6, paddingBottom: 4 }}>
      <PokerCard code={cards[0]} rankOnly width={cardWidth} style={{ transform: 'rotate(-7deg)', transformOrigin: 'bottom right' }} />
      <PokerCard
        code={cards[1]}
        rankOnly
        width={cardWidth}
        style={{ transform: 'rotate(7deg)', transformOrigin: 'bottom left', marginLeft: -Math.round(cardWidth * 0.22) }}
      />
    </div>
  );
}

const PICKER_CELL_BG = 'linear-gradient(155deg, #FFFFFF 0%, #F6E9C8 100%)';

function freeSuit(rank: CardRank, cards: readonly CardCode[]): CardSuit {
  const used = new Set(cards.filter((code) => code.startsWith(rank)).map((code) => code[1]));
  return CARD_SUITS.find((suit) => !used.has(suit)) ?? 's';
}

function toggleRank(cards: readonly CardCode[], rank: CardRank): CardCode[] {
  if (cards.length < 2) return [...cards, cardCode(rank, freeSuit(rank, cards))];
  const existing = cards.find((code) => code.startsWith(rank));
  if (!existing) return [...cards];
  return cards.filter((code) => code !== existing);
}

/** «Рука дня» in the timer settings: a tick, and when it is on, a list of 52 cards to choose two from. */
export function HandOfDayPicker({
  hand,
  onChange,
}: {
  hand: HandOfDay | undefined;
  onChange: (next: HandOfDay) => void;
}) {
  const on = hand?.on === true;
  const cards = normalizeHandCards(hand?.cards);

  const setOn = (next: boolean) => onChange({ on: next, cards });
  const setCards = (next: CardCode[]) => onChange({ on, cards: next });

  return (
    <div className="rounded-xl p-3" style={{ background: '#231A16', border: '1px solid rgba(217,153,98,0.3)' }}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#D99962]"
        />
        <span className="min-w-0">
          <span className="block text-[13px] font-800 text-white">Рука дня</span>
          <span className="mt-0.5 block text-[10px] font-600 leading-snug text-white/40">
            Две карты на таймере справа, под перерывом.
          </span>
        </span>
      </label>

      {on ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex min-h-[88px] flex-1 items-center gap-2">
              {cards.length === 0 ? (
                <p className="text-[11px] font-600 text-white/40">Выберите две карты из списка ниже</p>
              ) : (
                cards.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setCards(cards.filter((card) => card !== code))}
                    aria-label={`Убрать: ${cardName(code)}`}
                    className="rounded-lg active:scale-95"
                  >
                    <PokerCard code={code} rankOnly width={62} />
                  </button>
                ))
              )}
              {cards.length === 1 ? (
                <p className="text-[11px] font-600 leading-snug text-white/40">ещё одну</p>
              ) : null}
            </div>
            {cards.length > 0 ? (
              <button
                type="button"
                onClick={() => setCards([])}
                className="shrink-0 rounded-lg px-3 py-2 text-[11px] font-700"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#A39B98' }}
              >
                Сбросить
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {CARD_RANKS.map((rank) => {
              const picked = cards.some((code) => code.startsWith(rank));
              return (
                <button
                  key={rank}
                  type="button"
                  onClick={() => setCards(toggleRank(cards, rank))}
                  aria-pressed={picked}
                  aria-label={rankLabel(rank)}
                  className="flex h-11 items-center justify-center rounded-md text-[15px] font-900 active:scale-95"
                  style={{
                    background: PICKER_CELL_BG,
                    color: '#1A1411',
                    boxShadow: picked
                      ? '0 0 0 2px #D99962, 0 0 10px rgba(217,153,98,0.65)'
                      : 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                    opacity: !picked && cards.length === 2 ? 0.45 : 1,
                  }}
                >
                  {rankLabel(rank)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
