import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ITEMS = [
  { label: 'Finance & Results', to: '/admin/finance' },
  { label: 'Blinds Info', to: '/admin/blinds/settings' },
  { label: 'Ruby', to: '/admin/ruby' },
  { label: 'Tournaments', to: '/admin/tournaments' },
  { label: 'Achievements', to: '/admin/achievements/users' },
  { label: 'Statistic', to: '/admin/statistic' },
];

export function AdminBottomSheet({ open, onClose }: Props) {
  const navigate = useNavigate();

  const handleSelect = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="admin-sheet-overlay"
            className="absolute inset-0 z-[60] bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            key="admin-sheet"
            className="absolute bottom-0 left-0 right-0 z-[70] rounded-t-3xl p-6 bg-[#231A16] max-h-[85dvh] overflow-y-auto"
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
              border: '1px solid rgba(217,153,98,0.2)',
              borderBottom: 'none',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-6" />

            <div className="space-y-3">
              {ITEMS.map(({ label, to }) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => handleSelect(to)}
                  className="w-full py-4 rounded-2xl text-[15px] font-700 text-center tracking-wide active:scale-[0.98] transition-transform"
                  style={{
                    background: 'linear-gradient(to right, #2A211D, #463129)',
                    border: '1px solid rgba(217,153,98,0.28)',
                    color: '#D99962',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
