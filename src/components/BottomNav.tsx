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
                {/* Animated bubble */}
                {isActive && (
                  <motion.div
                    layoutId="nav-bubble"
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      inset: '6px 4px',
                      background:
                        'linear-gradient(135deg, rgba(140,76,39,0.4) 0%, rgba(217,153,98,0.16) 100%)',
                      border: '1px solid rgba(200,163,142,0.22)',
                    }}
                    transition={{ type: 'spring', bounce: 0.18, duration: 0.42 }}
                  />
                )}

                {/*
                  Active:   flex-row  → icon on left, label on right
                  Inactive: just icon centred
                */}
                <motion.div
                  layout
                  className="relative z-10 flex items-center justify-center gap-2"
                >
                  <motion.div
                    animate={{ scale: isActive ? 1.18 : 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  >
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2.3 : 1.6}
                      style={{
                        color: isActive ? '#c8a38e' : '#6B6360',
                        filter: isActive
                          ? 'drop-shadow(0 0 5px rgba(200,163,142,0.6))'
                          : 'none',
                        transition: 'color 0.2s',
                      }}
                    />
                  </motion.div>

                  {/* Label — ONLY for active tab, to the RIGHT of icon */}
                  <AnimatePresence initial={false}>
                    {isActive && (
                      <motion.span
                        key="label"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="text-[10px] font-700 uppercase tracking-wide leading-none select-none whitespace-nowrap"
                        style={{ color: '#c8a38e' }}
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
