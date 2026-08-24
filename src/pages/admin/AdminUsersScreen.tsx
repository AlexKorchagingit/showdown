import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { ScreenLoading } from '../../components/ScreenLoading';
import { ADMIN_EMAIL, useUser } from '../../context/UserContext';
import { useAuditLog } from '../../context/AuditLogContext';
import { CompactHeader } from '../../components/CompactHeader';
import { deleteUserRow, updateUserRow } from '../../lib/userApi';

export function AdminUsersScreen() {
  const { logAction } = useAuditLog();
  const { email, clubUsers, isLoading, refreshClubUsers } = useUser();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<(typeof clubUsers)[number] | null>(null);

  const toggleAdmin = async (id: string) => {
    const target = clubUsers.find((u) => u.id === id);
    if (!target || target.email.toLowerCase() === ADMIN_EMAIL) return;
    const granting = !target.isAdmin;
    setBusyId(id);
    const saved = await updateUserRow(id, { is_admin: granting });
    setBusyId(null);
    if (!saved) {
      window.alert('Не удалось обновить права администратора');
      return;
    }
    await refreshClubUsers();
    if (granting) {
      logAction({
        actionType: 'Выдал права администратора',
        targetUserId: target.id,
        targetUserEmail: target.email,
        targetUserName: target.nickname,
        details: 'Выданы права администратора',
      });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setBusyId(target.id);
    const result = await deleteUserRow(target.id);
    setBusyId(null);
    setPendingDelete(null);
    if (!result.ok) {
      const financeBlocked =
        result.code === '23503' ||
        /transactions|foreign key|restrict/i.test(result.message);
      window.alert(
        financeBlocked
          ? 'Не удалось удалить пользователя: остались связанные записи'
          : result.message || 'Не удалось удалить пользователя',
      );
      return;
    }
    await refreshClubUsers();
    logAction({
      actionType: 'Удалил пользователя',
      targetUserId: target.id,
      targetUserEmail: target.email,
      targetUserName: target.nickname,
    });
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

        {isLoading && clubUsers.length === 0 ? (
          <ScreenLoading label="Загрузка пользователей…" />
        ) : (
          <div className="space-y-3">
            {clubUsers.map((user) => {
              const isLocked = user.email.toLowerCase() === ADMIN_EMAIL;
              const isSelf = user.email.toLowerCase() === email.trim().toLowerCase();
              const canDelete = !isLocked && !isSelf;

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5"
                  style={{ background: '#231A16', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <PlayerAvatar
                    playerId={user.id}
                    nickname={user.nickname}
                    src={user.equippedAvatar}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
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

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(user)}
                      disabled={busyId === user.id}
                      className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.35)',
                      }}
                      aria-label={`Удалить ${user.nickname}`}
                    >
                      <Trash2 size={14} strokeWidth={2.3} style={{ color: '#f87171' }} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void toggleAdmin(user.id)}
                    disabled={isLocked || busyId === user.id}
                    aria-pressed={user.isAdmin}
                    aria-label={`Права администратора для ${user.nickname}`}
                    className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                      isLocked || busyId === user.id ? 'cursor-not-allowed opacity-70' : ''
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
        )}
      </div>

      {pendingDelete && (
        <div className="absolute inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/65"
            aria-label="Закрыть"
            onClick={() => setPendingDelete(null)}
          />
          <div
            className="relative w-full rounded-t-3xl px-4 pt-4 pb-8"
            style={{
              background: '#231A16',
              border: '1px solid rgba(239,68,68,0.35)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
            }}
          >
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-4" />
            <h2 className="text-[15px] font-800 uppercase tracking-wide text-white mb-2">
              Удалить пользователя
            </h2>
            <p className="text-[13px] font-500 leading-relaxed mb-5" style={{ color: '#A39B98' }}>
              Вы точно хотите удалить пользователя {pendingDelete.nickname}? Это действие необратимо.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="h-12 rounded-xl text-[14px] font-800"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: '#F2D8A7',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={busyId === pendingDelete.id}
                onClick={() => void confirmDelete()}
                className="h-12 rounded-xl text-[14px] font-800 text-white active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'linear-gradient(to right, #7f1d1d, #ef4444)' }}
              >
                {busyId === pendingDelete.id ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
