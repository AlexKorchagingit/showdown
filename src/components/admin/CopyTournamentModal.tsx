import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  open: boolean;
  busy: boolean;
  playerCount: number;
  onClose: () => void;
  onCopyWithPlayers: () => void;
  onCopyWithoutPlayers: () => void;
}

export function CopyTournamentModal({
  open,
  busy,
  playerCount,
  onClose,
  onCopyWithPlayers,
  onCopyWithoutPlayers,
}: Props) {
  const playersLabel =
    playerCount === 1 ? '1 игрок' : `${playerCount.toLocaleString('ru-RU')} игроков`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-[80] flex items-center justify-center px-6 bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => {
            if (!busy) onClose();
          }}
        >
          <motion.div
            className="w-full max-w-[340px] rounded-2xl p-5 bg-[#231A16]/95 backdrop-blur-md border border-[#D99962]/30"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="copy-tournament-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="copy-tournament-title"
              className="text-[16px] font-900 text-white uppercase tracking-wide"
            >
              Скопировать турнир
            </h2>
            <p className="text-[13px] font-400 leading-relaxed mt-2 mb-5" style={{ color: '#A39B98' }}>
              {playerCount > 0
                ? `Сейчас в составе ${playersLabel}. Места, очки и нокауты в копию не переносятся.`
                : 'Состав пустой. Можно скопировать только настройки турнира.'}
            </p>

            <div className="space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={onCopyWithPlayers}
                className="w-full h-12 rounded-xl text-[14px] font-800 text-[#0A0908] active:scale-[0.98] disabled:opacity-45"
                style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
              >
                {busy ? 'Копирование…' : 'С участниками'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCopyWithoutPlayers}
                className="w-full h-12 rounded-xl text-[14px] font-800 active:scale-[0.98] disabled:opacity-45"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: '#F2D8A7',
                  border: '1px solid rgba(217,153,98,0.28)',
                }}
              >
                Без участников
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="w-full h-11 rounded-xl text-[13px] font-700 disabled:opacity-45"
                style={{ color: '#8c8c88' }}
              >
                Отмена
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
