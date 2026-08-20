import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SectionScreen } from '../../components/SectionScreen';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { ScreenLoading } from '../../components/ScreenLoading';
import { useUser } from '../../context/UserContext';

export function AdminAchievementsUsers() {
  const navigate = useNavigate();
  const { clubUsers, isLoading } = useUser();

  return (
    <SectionScreen title="Achievements" backTo="/profile">
      <p className="text-[12px] font-500 mb-3" style={{ color: '#6B6360' }}>
        Выберите пользователя, чтобы выдать или править достижения
      </p>

      {isLoading && clubUsers.length === 0 ? (
        <ScreenLoading label="Загрузка пользователей…" />
      ) : (
        <div className="space-y-3">
          {clubUsers.map((user) => (
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
