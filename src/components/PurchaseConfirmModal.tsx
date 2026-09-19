import { AnimatePresence, motion } from 'framer-motion';
import { Gem } from 'lucide-react';
import type { ShopItem } from '../data/shopItems';

interface Props {
  item: ShopItem | null;
  coins: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TYPE_LABEL: Record<ShopItem['type'], string> = {
  character: 'Персонаж',
  bg: 'Фон',
};

function amount(value: number): string {
  return value.toLocaleString('ru-RU');
}

/** Nobody buys a character by a stray tap: the price is confirmed first. */
export function PurchaseConfirmModal({ item, coins, busy, onConfirm, onCancel }: Props) {
  const left = item ? coins - item.price : 0;

  return (
    <AnimatePresence>
      {item ? (
        <motion.div
          className="absolute inset-0 z-[120] flex items-center justify-center px-6 bg-black/75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => { if (!busy) onCancel(); }}
        >
          <motion.div
            className="w-full max-w-[320px] rounded-2xl p-5 bg-[#231A16] border border-[#D99962]/35 text-center"
            style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.65)' }}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-24 w-24 overflow-hidden rounded-xl bg-[#1d0b07]">
              <img
                src={item.image}
                alt=""
                aria-hidden="true"
                draggable={false}
                className={`h-full w-full ${item.type === 'bg' ? 'object-cover' : 'object-contain object-bottom'}`}
              />
            </div>

            <p className="text-[11px] font-700 uppercase tracking-[0.16em] text-[#D99962]">
              {TYPE_LABEL[item.type]}
            </p>
            <h2 className="mt-1 text-[17px] font-black leading-snug text-white">Точно купить?</h2>
            <p className="mt-1 text-[14px] font-700 text-[#F2D8A7]">{item.name}</p>

            <div className="mt-4 space-y-1 rounded-xl bg-[#1d0b07] px-3 py-2 text-[12px] font-600">
              <p className="flex items-center justify-between text-white/70">
                <span>Цена</span>
                <span className="inline-flex items-center gap-1 text-[#F2D8A7]">
                  <Gem size={13} strokeWidth={2.4} />
                  {amount(item.price)}
                </span>
              </p>
              <p className="flex items-center justify-between text-white/50">
                <span>Остаток после покупки</span>
                <span>{amount(left)}</span>
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="h-11 flex-1 rounded-xl border border-white/10 bg-[#1d0b07] text-[14px] font-700 text-white/70 active:scale-[0.97] disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="h-11 flex-1 rounded-xl text-[14px] font-800 text-[#0A0908] active:scale-[0.97] disabled:opacity-60"
                style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
              >
                {busy ? 'Покупаем…' : 'Купить'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
