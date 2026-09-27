import { AnimatePresence, motion } from 'framer-motion';
import { tournamentDeleteWarning } from '../../lib/tournamentDelete';

interface Props {
  open: boolean;
  busy: boolean;
  closed: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTournamentModal({
  open,
  busy,
  closed,
  title,
  onClose,
  onConfirm,
}: Props) {
  const copy = tournamentDeleteWarning(closed);

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
            className="w-full max-w-[340px] rounded-2xl p-5 bg-[#231A16]/95 backdrop-blur-md border border-red-500/30"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-tournament-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="delete-tournament-title"
              className="text-[16px] font-900 text-white uppercase tracking-wide"
            >
              {copy.title}
            </h2>
            <p className="text-[14px] font-700 text-[#F2D8A7] mt-2">{title}</p>
            <p className="text-[13px] font-400 leading-relaxed mt-2" style={{ color: '#A39B98' }}>
              {copy.body}
            </p>
            <p className="text-[12px] font-600 mt-3" style={{ color: '#f87171' }}>
              Это действие нельзя отменить.
            </p>

            <div className="space-y-2 mt-5">
              <button
                type="button"
                disabled={busy}
                onClick={onConfirm}
                className="w-full h-12 rounded-xl text-[14px] font-800 text-white active:scale-[0.98] disabled:opacity-45"
                style={{ background: 'linear-gradient(to right, #7f1d1d, #dc2626)' }}
              >
                {busy ? 'Удаление…' : 'Удалить турнир'}
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
