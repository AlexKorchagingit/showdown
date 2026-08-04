import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Coins } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { CoinBalance } from '../components/CoinBalance';
import { shopItemsOfType, type ShopItem, type ShopItemType } from '../data/shopItems';

const TAB_ORDER: ShopItemType[] = ['character', 'bg'];
const TAB_LABEL: Record<ShopItemType, string> = {
  character: 'Персонажи',
  bg: 'Фоны',
};

function ItemCard({
  item,
  owned,
  equipped,
  affordable,
  onBuy,
  onEquip,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
  onBuy: () => void;
  onEquip: () => void;
}) {
  return (
    <div
      className={`rounded-2xl overflow-hidden bg-[#231A16] border border-white/[0.06] ${
        equipped ? 'ring-2 ring-[#D99962] shadow-[0_0_15px_rgba(217,153,98,0.5)]' : ''
      }`}
    >
      <div className="aspect-square relative overflow-hidden bg-[#1d0b07]">
        <img
          src={item.image}
          alt={item.name}
          className={`absolute inset-0 w-full h-full ${
            item.type === 'character' ? 'object-contain p-2' : 'object-cover'
          }`}
        />
      </div>

      <div className="px-3 py-2.5 space-y-2">
        <p className="text-[13px] font-bold text-white truncate">{item.name}</p>

        {!owned ? (
          <button
            type="button"
            onClick={onBuy}
            disabled={!affordable}
            className={`w-full h-9 rounded-xl flex items-center justify-center gap-1.5 text-[13px] font-bold transition-all active:scale-[0.97] ${
              affordable ? 'text-[#0A0908]' : 'cursor-not-allowed bg-[#463129] text-white/40'
            }`}
            style={
              affordable
                ? { background: 'linear-gradient(to right, #8C4C27, #D99962)' }
                : undefined
            }
          >
            <Coins size={15} strokeWidth={2.4} />
            {item.price.toLocaleString('ru-RU')}
          </button>
        ) : equipped ? (
          <p className="h-9 flex items-center justify-center text-[13px] font-bold text-[#D99962]">
            Выбрано
          </p>
        ) : (
          <button
            type="button"
            onClick={onEquip}
            className="w-full h-9 rounded-xl flex items-center justify-center text-[13px] font-600 text-[#8c8c88] bg-[#1d0b07] border border-white/[0.08] active:scale-[0.97] transition-transform"
          >
            Куплено
          </button>
        )}
      </div>
    </div>
  );
}

export function ShopScreen() {
  const navigate = useNavigate();
  const { coins, isOwned, isEquipped, buyItem, equipItem } = useProfile();
  const [tab, setTab] = useState<ShopItemType>('character');

  const items = shopItemsOfType(tab);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="absolute top-4 left-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(28,20,16,0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(217,153,98,0.28)',
        }}
        aria-label="Назад"
      >
        <ArrowLeft size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <div className="absolute top-6 right-4 z-50">
        <CoinBalance coins={coins} />
      </div>

      <div className="flex-shrink-0 px-5 pt-20 pb-4 space-y-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          Магазин
        </h1>

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
            className="grid grid-cols-2 gap-4 px-4"
          >
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                owned={isOwned(item.id)}
                equipped={isEquipped(item.id)}
                affordable={coins >= item.price}
                onBuy={() => buyItem(item.id)}
                onEquip={() => equipItem(item.id)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
