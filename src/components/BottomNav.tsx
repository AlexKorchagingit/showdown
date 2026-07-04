import { NavLink } from 'react-router-dom';
import { Home, Trophy, BarChart2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_ITEMS = [
  { to: '/',            label: 'Главная',  Icon: Home },
  { to: '/tournaments', label: 'Турниры',  Icon: Trophy },
  { to: '/rating',      label: 'Рейтинг',  Icon: BarChart2 },
  { to: '/profile',     label: 'Профиль',  Icon: User },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 px-4"
      style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 8px), 12px)' }}
    >
      {/* Floating pill */}
      <div
        className="flex items-stretch h-[58px] rounded-full overflow-hidden"
        style={{
          background: 'rgba(25, 18, 14, 0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.04)',
        }}
      >
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="flex-1 relative flex items-center justify-center"
          >
            {({ isActive }) => (
              <>
                {/* Bubble glides between active items */}
                {isActive && (
                  <motion.div
                    layoutId="nav-bubble"
                    className="absolute pointer-events-none rounded-full"
                    style={{
                      inset: '6px 4px',
                      background:
                        'linear-gradient(135deg, rgba(140,76,39,0.4) 0%, rgba(217,153,98,0.16) 100%)',
                      border: '1px solid rgba(200,163,142,0.22)',
                    }}
                    transition={{ type: 'spring', bounce: 0.18, duration: 0.42 }}
                  />
                )}

                {/* Icon (always visible) + label (only when active) */}
                <div className="relative z-10 flex flex-col items-center justify-center gap-[3px] h-full w-full">
                  <motion.div
                    animate={{ scale: isActive ? 1.22 : 1, y: isActive ? -1 : 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  >
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2.3 : 1.6}
                      style={{
                        color: isActive ? '#c8a38e' : '#6B6360',
                        filter: isActive ? 'drop-shadow(0 0 5px rgba(200,163,142,0.6))' : 'none',
                        transition: 'color 0.2s',
                      }}
                    />
                  </motion.div>

                  {/* Label — ONLY active tab, bold + uppercase, fades in */}
                  <AnimatePresence initial={false}>
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15, delay: 0.05 }}
                        className="text-[9px] font-700 uppercase tracking-wide leading-none select-none"
                        style={{ color: '#c8a38e' }}
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
