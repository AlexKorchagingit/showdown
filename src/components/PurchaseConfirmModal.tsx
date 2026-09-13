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

const KIND_LABEL: Record<ShopItem['type'], string> = {
  character: 'персонажа',
  bg: 'фон',
};

export function PurchaseConfirmModal({ item, coins, busy, onConfirm, onCancel }: Props) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="absolute inset-0 z-[60] flex items-center justify-center px-6 bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={busy ? undefined : onCancel}
        >
          <motion.div
            className="w-full max-w-[320px] rounded-2xl p-6 bg-[#231A16]/95 backdrop-blur-md border border-[#D99962]/30 text-center"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-28 w-24 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1d0b07]">
              <img
                src={item.image}
                alt={item.name}
                className={`h-full w-full ${item.type === 'bg' ? 'object-cover' : 'object-contain object-bottom'}`}
              />
            </div>

            <h2 className="mb-1 text-[17px] font-black text-white">Точно купить?</h2>
            <p className="mb-4 text-[13px] font-400 leading-relaxed" style={{ color: '#A39B98' }}>
              Покупаете {KIND_LABEL[item.type]} «{item.name}». Рубины списываются сразу.
            </p>

            <div className="mb-5 space-y-1.5 rounded-xl border border-white/[0.06] bg-[#1d0b07] px-4 py-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span style={{ color: '#A39B98' }}>Цена</span>
                <span className="flex items-center gap-1 font-bold text-[#D99962]">
                  <Gem size={13} strokeWidth={2.4} />
                  {item.price.toLocaleString('ru-RU')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: '#A39B98' }}>Останется</span>
                <span className="font-bold text-white">
                  {Math.max(0, coins - item.price).toLocaleString('ru-RU')}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="h-11 flex-1 rounded-xl border border-white/[0.1] text-[14px] font-600 text-white/80 active:scale-[0.97] transition-transform disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="h-11 flex-1 rounded-xl text-[14px] font-bold text-[#0A0908] active:scale-[0.97] transition-transform disabled:opacity-50"
                style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
              >
                {busy ? 'Покупаем…' : 'Купить'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
