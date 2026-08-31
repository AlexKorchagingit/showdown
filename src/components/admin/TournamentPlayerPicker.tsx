import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link2, Plus, UserPlus } from 'lucide-react';
import { PlayerAvatar } from '../PlayerAvatar';
import { GUEST_NICKNAME_MAX } from '../../lib/guestPlayer';
import type { MappedUser } from '../../lib/supabaseMap';

export function TournamentPlayerPicker({
  open,
  users,
  linkingNickname,
  onPickUser,
  onAddGuestNick,
}: {
  open: boolean;
  users: MappedUser[];
  linkingNickname?: string;
  onPickUser: (user: MappedUser) => void;
  onAddGuestNick?: (nickname: string) => void;
}) {
  const [guestNickOpen, setGuestNickOpen] = useState(false);
  const [guestNick, setGuestNick] = useState('');

  return (
    <AnimatePresence
      initial={false}
      onExitComplete={() => {
        setGuestNickOpen(false);
        setGuestNick('');
      }}
    >
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="overflow-hidden"
        >
          <div
            className="mt-2 max-h-64 scrollable space-y-1.5 rounded-xl p-2"
            style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {linkingNickname ? (
              <p className="px-2 pt-1 pb-0.5 text-[11px] font-600" style={{ color: '#A39B98' }}>
                Выберите пользователя системы для ника «{linkingNickname}»
              </p>
            ) : null}
            {users.length === 0 ? (
              <p className="text-center text-[12px] py-3" style={{ color: '#6B6360' }}>
                {linkingNickname
                  ? 'Нет свободных пользователей для привязки'
                  : 'Все пользователи уже в турнире'}
              </p>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onPickUser(user)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg active:scale-[0.98]"
                  style={{ background: '#231A16' }}
                >
                  <span className="min-w-0 text-left flex-1 flex items-center gap-3">
                    <PlayerAvatar playerId={user.id} nickname={user.nickname} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-700 text-white truncate">
                        {user.nickname}
                      </span>
                      {user.email ? (
                        <span className="block text-[11px] text-white/80 truncate">{user.email}</span>
                      ) : null}
                    </span>
                  </span>
                  {linkingNickname ? (
                    <Link2 size={15} strokeWidth={2.4} style={{ color: '#D99962' }} />
                  ) : (
                    <Plus size={15} strokeWidth={2.4} style={{ color: '#D99962' }} />
                  )}
                </button>
              ))
            )}
            {!linkingNickname && onAddGuestNick ? (
              <div className="pt-1.5 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {guestNickOpen ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      onAddGuestNick(guestNick);
                      setGuestNick('');
                    }}
                  >
                    <input
                      value={guestNick}
                      onChange={(e) => setGuestNick(e.target.value)}
                      maxLength={GUEST_NICKNAME_MAX}
                      placeholder="Ник игрока"
                      autoFocus
                      className="flex-1 min-w-0 h-10 rounded-lg px-3 text-[13px] text-white outline-none"
                      style={{
                        background: '#231A16',
                        border: '1px solid rgba(217,153,98,0.35)',
                      }}
                    />
                    <button
                      type="submit"
                      className="h-10 px-3 rounded-lg text-[12px] font-800 shrink-0"
                      style={{
                        background: 'linear-gradient(to right, #8C4C27, #D99962)',
                        color: '#0A0908',
                      }}
                    >
                      Ок
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setGuestNickOpen(true)}
                    className="w-full h-10 rounded-lg text-[12px] font-800 active:scale-[0.98]"
                    style={{
                      background: 'rgba(217,153,98,0.12)',
                      border: '1px solid rgba(217,153,98,0.35)',
                      color: '#F2D8A7',
                    }}
                  >
                    Добавить ник игрока
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AddTournamentPlayerButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-[13px] font-800 active:scale-[0.98] transition-transform"
      style={{
        background: 'rgba(217,153,98,0.12)',
        border: '1px solid rgba(217,153,98,0.4)',
        color: '#F2D8A7',
      }}
    >
      <UserPlus size={16} strokeWidth={2.3} />
      {label}
    </button>
  );
}
