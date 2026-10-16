import { PokerCard, SuitIcon } from './PokerCard';
import {
  CARD_RANKS,
  CARD_SUITS,
  SUIT_COLORS,
  cardCode,
  cardName,
  normalizeHandCards,
  rankLabel,
  toggleHandCard,
  type CardCode,
  type HandOfDay,
} from '../lib/pokerCards';

/** The two cards of the day, fanned like a hand, for the timer. */
export function HandOfDayCards({ cards, cardWidth = 88 }: { cards: [CardCode, CardCode]; cardWidth?: number }) {
  return (
    <div className="flex items-end justify-center" style={{ paddingTop: 6, paddingBottom: 4 }}>
      <PokerCard code={cards[0]} width={cardWidth} style={{ transform: 'rotate(-7deg)', transformOrigin: 'bottom right' }} />
      <PokerCard
        code={cards[1]}
        width={cardWidth}
        style={{ transform: 'rotate(7deg)', transformOrigin: 'bottom left', marginLeft: -Math.round(cardWidth * 0.22) }}
      />
    </div>
  );
}

const PICKER_CELL_BG = 'linear-gradient(155deg, #FFFFFF 0%, #F6E9C8 100%)';

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
                    <PokerCard code={code} width={62} />
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

          <div className="space-y-1">
            {CARD_SUITS.map((suit) => (
              <div key={suit} className="flex gap-[3px]">
                {CARD_RANKS.map((rank) => {
                  const code = cardCode(rank, suit);
                  const picked = cards.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCards(toggleHandCard(cards, code))}
                      aria-pressed={picked}
                      aria-label={cardName(code)}
                      className="flex h-10 min-w-0 flex-1 flex-col items-center justify-center gap-[2px] rounded-md active:scale-95"
                      style={{
                        background: PICKER_CELL_BG,
                        color: SUIT_COLORS[suit],
                        boxShadow: picked
                          ? '0 0 0 2px #D99962, 0 0 10px rgba(217,153,98,0.65)'
                          : 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                        opacity: !picked && cards.length === 2 ? 0.85 : 1,
                      }}
                    >
                      <span className="text-[11px] font-900 leading-none">{rankLabel(rank)}</span>
                      <SuitIcon suit={suit} size={11} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
