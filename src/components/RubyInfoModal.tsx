import { AnimatePresence, motion } from 'framer-motion';
import { Gem } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RubyInfoModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center px-6 bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-[320px] rounded-2xl p-6 bg-[#231A16]/90 backdrop-blur-md border border-[#D99962]/30 text-center"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(217,153,98,0.16)', border: '1px solid rgba(217,153,98,0.4)' }}
            >
              <Gem size={22} strokeWidth={2.2} className="text-[#D99962]" />
            </div>

            <h2 className="text-[17px] font-black text-white mb-3">Как заработать рубины?</h2>

            <p className="text-[13px] font-400 leading-relaxed mb-6" style={{ color: '#A39B98' }}>
              Рубины выдаются за попадание в призы на турнирах, выбивание оппонентов (нокауты)
              и за прочие активности
            </p>

            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-xl text-[14px] font-bold text-[#0A0908] active:scale-[0.97] transition-transform"
              style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
            >
              Понятно
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
