import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Gem } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { CoinBalance } from '../components/CoinBalance';
import { RubyInfoModal } from '../components/RubyInfoModal';
import { shopItemsOfType, type ShopItem, type ShopItemType } from '../data/shopItems';

const TAB_ORDER: ShopItemType[] = ['character', 'bg'];
const TAB_LABEL: Record<ShopItemType, string> = {
  character: 'Персонажи',
  bg: 'Фоны',
};

/** Price tag, «Куплено» or «Выбрано» — the same control in both card layouts. */
function ItemStatus({
  item,
  owned,
  equipped,
  affordable,
  overlay,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
  overlay: boolean;
}) {
  if (!owned) {
    return (
      <span
        className={`w-full h-9 rounded-xl flex items-center justify-center gap-1.5 text-[13px] font-bold ${
          affordable ? 'text-[#0A0908]' : 'bg-[#463129] text-white/40'
        }`}
        style={
          affordable ? { background: 'linear-gradient(to right, #8C4C27, #D99962)' } : undefined
        }
      >
        <Gem size={15} strokeWidth={2.4} />
        {item.price.toLocaleString('ru-RU')}
      </span>
    );
  }

  if (equipped) {
    return (
      <span
        className={`w-full h-9 flex items-center justify-center text-[13px] font-bold text-[#D99962] ${
          overlay ? 'rounded-xl bg-[#1d0b07]/85 border border-[#D99962]/40' : ''
        }`}
      >
        Выбрано
      </span>
    );
  }

  return (
    <span
      className={`w-full h-9 rounded-xl flex items-center justify-center text-[13px] font-600 text-[#8c8c88] border border-white/[0.08] ${
        overlay ? 'bg-[#1d0b07]/85' : 'bg-[#1d0b07]'
      }`}
    >
      Куплено
    </span>
  );
}

/** The whole card is the control: owned items get equipped, the rest get bought. */
function ItemCard({
  item,
  owned,
  equipped,
  affordable,
  onSelect,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
  onSelect: () => void;
}) {
  const locked = !owned && !affordable;
  const isBackground = item.type === 'bg';
  const isKing = item.id === 'char_king';
  const isPremium = item.price >= 12000 && !isKing;

  const rarityClass = isKing
    ? 'ring-2 ring-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.4)] bg-gradient-to-t from-yellow-900/40 to-transparent'
    : isPremium || equipped
      ? 'ring-2 ring-[#D99962] shadow-[0_0_15px_rgba(217,153,98,0.5)]'
      : '';

  // Every card keeps the same portrait rectangle so both tabs line up
  const cardClass = `relative aspect-[3/4] text-left rounded-2xl overflow-hidden bg-[#231A16] border border-white/[0.06] transition-transform ${rarityClass} ${
    locked ? 'cursor-not-allowed' : 'active:scale-[0.97]'
  }`;

  const status = (
    <ItemStatus
      item={item}
      owned={owned}
      equipped={equipped}
      affordable={affordable}
      overlay={isBackground}
    />
  );

  // Backgrounds are shown edge to edge with the control floating on the artwork
  if (isBackground) {
    return (
      <button type="button" onClick={onSelect} disabled={locked} className={cardClass}>
        <img
          src={item.image}
          alt={item.name}
          className="absolute inset-0 w-full h-full object-cover rounded-xl"
        />
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] z-10">{status}</span>
      </button>
    );
  }

  return (
    <button type="button" onClick={onSelect} disabled={locked} className={`${cardClass} flex flex-col`}>
      <div className="flex-1 min-h-0 relative overflow-hidden bg-[#1d0b07]">
        <img
          src={item.image}
          alt={item.name}
          className="absolute inset-0 w-full h-full object-contain p-2"
        />
      </div>

      <div className="shrink-0 px-3 py-2.5 space-y-2">
        <p className="text-[13px] font-bold text-white truncate">{item.name}</p>
        {status}
      </div>
    </button>
  );
}

export function ShopScreen() {
  const navigate = useNavigate();
  const { coins, isOwned, isEquipped, buyItem, equipItem } = useProfile();
  const [tab, setTab] = useState<ShopItemType>('character');
  const [rubyInfoOpen, setRubyInfoOpen] = useState(false);

  const items = shopItemsOfType(tab);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <div className="relative flex-shrink-0 flex items-center justify-between px-3 py-3">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10"
          style={{
            background: 'rgba(28,20,16,0.78)',
            border: '1px solid rgba(217,153,98,0.28)',
          }}
          aria-label="Назад"
        >
          <ArrowLeft size={20} strokeWidth={2.2} style={{ color: '#D99962' }} />
        </button>

        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-bold tracking-[0.14em] text-white uppercase pointer-events-none">
          Магазин
        </h1>

        <button
          type="button"
          onClick={() => setRubyInfoOpen(true)}
          className="shrink-0 z-10 active:scale-95 transition-transform"
          aria-label="Как заработать рубины"
        >
          <CoinBalance coins={coins} compact />
        </button>
      </div>

      <div className="flex-shrink-0 px-5 pb-3">
        <div className="relative flex rounded-xl p-1" style={{ background: '#1E1612' }}>
          {TAB_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="relative flex-1 py-2.5 text-[13px] font-600 rounded-lg transition-colors duration-200"
              style={{ color: tab === t ? '#0A0908' : '#6B6360' }}
            >
              {tab === t && (
                <motion.span
                  layoutId="shop-tab"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.38 }}
                />
              )}
              <span className="relative z-10">{TAB_LABEL[t]}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex-1 scrollable"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="grid grid-cols-2 gap-4 px-4 mt-3"
          >
            {items.map((item) => {
              const owned = isOwned(item.id);
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  owned={owned}
                  equipped={isEquipped(item.id)}
                  affordable={coins >= item.price}
                  onSelect={() => (owned ? equipItem(item.id) : buyItem(item.id))}
                />
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <RubyInfoModal open={rubyInfoOpen} onClose={() => setRubyInfoOpen(false)} />
    </div>
  );
}
