import { NavLink } from 'react-router-dom';
import { Home, Trophy, BarChart2, User } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',            label: 'Главная',  Icon: Home },
  { to: '/tournaments', label: 'Турниры',  Icon: Trophy },
  { to: '/rating',      label: 'Рейтинг',  Icon: BarChart2 },
  { to: '/profile',     label: 'Профиль',  Icon: User },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#50444c]"
      style={{
        borderTop: '1px solid rgba(200,163,142,0.18)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex flex-col items-center justify-center flex-1 gap-1 transition-all duration-200 relative',
                isActive ? 'text-[#c8a38e]' : 'text-[#69584f]',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #8C4C27, #c8a38e)' }}
                  />
                )}
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2 : 1.5}
                  style={isActive ? { filter: 'drop-shadow(0 0 5px rgba(200,163,142,0.65))' } : {}}
                />
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
