import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { mockUsers as initialUsers, type MockUser } from '../../data/mockUsers';
import { ADMIN_EMAIL } from '../../context/UserContext';

export function AdminUsersScreen() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<MockUser[]>(initialUsers);

  const toggleAdmin = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id && u.email.toLowerCase() !== ADMIN_EMAIL
          ? { ...u, isAdmin: !u.isAdmin }
          : u,
      ),
    );
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="absolute top-4 left-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(28,20,16,0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(217,153,98,0.28)',
        }}
      >
        <ArrowLeft size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <div
        className="flex-1 scrollable px-5 pt-20"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase mb-2">
          Пользователи
        </h1>
        <p className="text-center text-[12px] font-500 mb-8" style={{ color: '#6B6360' }}>
          Отметьте, кто должен получить права администратора
        </p>

        <div className="space-y-3">
          {users.map((user) => {
            const isLocked = user.email.toLowerCase() === ADMIN_EMAIL;

            return (
              <div
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5"
                style={{ background: '#231A16', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="min-w-0">
                  <p className="text-white font-700 text-[15px] truncate">{user.nickname}</p>
                  <p className="text-[12px] font-500 truncate" style={{ color: '#8c8c88' }}>
                    {user.email}
                  </p>
                  {isLocked && (
                    <p className="text-[11px] font-600 mt-0.5" style={{ color: '#D99962' }}>
                      Главный администратор
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggleAdmin(user.id)}
                  disabled={isLocked}
                  aria-pressed={user.isAdmin}
                  aria-label={`Права администратора для ${user.nickname}`}
                  className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                    isLocked ? 'cursor-not-allowed opacity-70' : ''
                  }`}
                  style={
                    user.isAdmin
                      ? {
                          background: 'linear-gradient(to right, #8C4C27, #D99962)',
                          border: '1px solid rgba(217,153,98,0.6)',
                        }
                      : {
                          background: 'transparent',
                          border: '1.5px solid rgba(217,153,98,0.35)',
                        }
                  }
                >
                  {user.isAdmin && <Check size={16} strokeWidth={3} style={{ color: '#0A0908' }} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
