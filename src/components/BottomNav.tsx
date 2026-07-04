import { NavLink } from 'react-router-dom';
import { Home, Trophy, BarChart2, User } from 'lucide-react';
import { motion } from 'framer-motion';

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
                {/* Animated bubble behind active item */}
                {isActive && (
                  <motion.div
                    layoutId="nav-bubble"
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      inset: '7px 5px',
                      background:
                        'linear-gradient(135deg, rgba(140,76,39,0.38) 0%, rgba(217,153,98,0.15) 100%)',
                      border: '1px solid rgba(200,163,142,0.2)',
                    }}
                    transition={{ type: 'spring', bounce: 0.18, duration: 0.42 }}
                  />
                )}

                {/* Icon + label — horizontal, always visible, bold + uppercase */}
                <div className="relative z-10 flex flex-row items-center gap-[7px]">
                  <motion.div
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  >
                    <Icon
                      size={17}
                      strokeWidth={isActive ? 2.3 : 1.7}
                      style={{
                        color: isActive ? '#c8a38e' : '#6B6360',
                        filter: isActive
                          ? 'drop-shadow(0 0 4px rgba(200,163,142,0.55))'
                          : 'none',
                        transition: 'color 0.2s',
                      }}
                    />
                  </motion.div>

                  <span
                    className="text-[10px] font-700 uppercase tracking-wide leading-none select-none"
                    style={{
                      color: isActive ? '#c8a38e' : '#6B6360',
                      transition: 'color 0.2s',
                    }}
                  >
                    {label}
                  </span>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
