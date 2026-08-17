import { useState } from 'react';
import { Check } from 'lucide-react';
import { mockUsers as initialUsers, type MockUser } from '../../data/mockUsers';
import { ADMIN_EMAIL, useUser } from '../../context/UserContext';
import { useAuditLog } from '../../context/AuditLogContext';
import { CompactHeader } from '../../components/CompactHeader';

export function AdminUsersScreen() {
  const { email } = useUser();
  const { logAction } = useAuditLog();
  const [users, setUsers] = useState<MockUser[]>(initialUsers);

  const toggleAdmin = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target || target.email.toLowerCase() === ADMIN_EMAIL) return;
    const granting = !target.isAdmin;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id && u.email.toLowerCase() !== ADMIN_EMAIL
          ? { ...u, isAdmin: !u.isAdmin }
          : u,
      ),
    );
    if (granting) {
      logAction(
        email,
        'Админ',
        `Пользователю ${target.nickname} выданы права администратора`,
        target.email,
      );
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <CompactHeader title="Пользователи" backTo="/settings" />

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <p className="text-[12px] font-500 mb-3 px-1" style={{ color: '#6B6360' }}>
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
