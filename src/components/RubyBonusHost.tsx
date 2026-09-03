import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Gem } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import type { PendingNotification } from '../lib/userStorage';

export function RubyBonusHost() {
  const { pendingNotifications, claimFirstNotification, walletBusy, walletLoading, walletError, refreshWallet } = useProfile();
  const [bonus, setBonus] = useState<PendingNotification | null>(null);

  useEffect(() => {
    setBonus(pendingNotifications[0] ?? null);
  }, [pendingNotifications]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {bonus && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center px-6 bg-black/75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="w-full max-w-[340px] rounded-2xl p-6 bg-[#231A16] border border-[#D99962]/35 text-center"
            style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.65)' }}
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: 'linear-gradient(to bottom, rgba(217,153,98,0.28), rgba(140,76,39,0.18))',
                border: '1px solid rgba(217,153,98,0.45)',
                boxShadow: '0 0 22px rgba(217,153,98,0.28)',
              }}
            >
              <Gem size={24} strokeWidth={2.2} className="text-[#F2D8A7]" />
            </div>

            <h2 className="text-[17px] font-black text-white leading-snug mb-2">
              🎉 БОНУС! {bonus.message}
            </h2>
            <p className="text-[15px] font-800 mb-6" style={{ color: '#86efac' }}>
              К получению: +{bonus.amount.toLocaleString('ru-RU')} рубинов
            </p>

            {walletError ? (
              <div className="text-[12px] text-red-300 mb-3">
                <p>{walletError}</p>
                <button type="button" onClick={() => void refreshWallet()} className="underline mt-1">Обновить кошелёк</button>
              </div>
            ) : null}
            <button
              type="button"
              disabled={walletBusy || walletLoading || Boolean(walletError)}
              onClick={() => void claimFirstNotification()}
              className="w-full h-12 rounded-xl text-[15px] font-800 text-[#0A0908] active:scale-[0.97] disabled:opacity-50 transition-transform"
              style={{
                background: 'linear-gradient(to right, #8C4C27, #D99962)',
                boxShadow: '0 0 18px rgba(217,153,98,0.32)',
              }}
            >
              {walletBusy ? 'Подтверждение…' : 'Забрать'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
