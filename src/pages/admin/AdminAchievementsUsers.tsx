import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { SectionScreen } from '../../components/SectionScreen';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { ScreenLoading } from '../../components/ScreenLoading';
import { useUser } from '../../context/UserContext';
import { matchesPlayerSearch } from '../../lib/playerSearch';

export function AdminAchievementsUsers() {
  const navigate = useNavigate();
  const { clubUsers, isLoading } = useUser();
  const [query, setQuery] = useState('');
  const visibleUsers = useMemo(
    () => clubUsers.filter((user) => matchesPlayerSearch(user, query)),
    [clubUsers, query],
  );

  return (
    <SectionScreen title="Achievements" backTo="/profile">
      <p className="text-[12px] font-500 mb-3" style={{ color: '#6B6360' }}>
        Выберите пользователя, чтобы выдать или править достижения
      </p>

      <label className="relative mb-3 block">
        <Search
          size={14}
          strokeWidth={2.4}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: '#A39B98' }}
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по нику"
          className="w-full h-10 rounded-lg pl-9 pr-3 text-[13px] text-white outline-none"
          style={{
            background: '#231A16',
            border: '1px solid rgba(217,153,98,0.35)',
          }}
        />
      </label>

      {isLoading && clubUsers.length === 0 ? (
        <ScreenLoading label="Загрузка пользователей…" />
      ) : visibleUsers.length === 0 ? (
        <p className="text-center text-[13px] font-500 py-8" style={{ color: '#6B6360' }}>
          Никого не нашли
        </p>
      ) : (
        <div className="space-y-3">
          {visibleUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => navigate(`/admin/achievements/edit/${user.id}`)}
              className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
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
              </div>
              <ChevronRight size={20} strokeWidth={2} style={{ color: '#D99962' }} />
            </button>
          ))}
        </div>
      )}
    </SectionScreen>
  );
}
