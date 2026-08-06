import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { SectionScreen } from '../../components/SectionScreen';
import { ACHIEVEMENTS, type AchievementProgress } from '../../data/achievements';
import { mockUsers } from '../../data/mockUsers';
import {
  loadAchievementProgress,
  saveAchievementProgress,
} from '../../lib/achievementStorage';

export function AdminAchievementsEditor() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const user = useMemo(
    () => mockUsers.find((u) => u.id === userId),
    [userId],
  );

  const storageKey = user?.email ?? '';

  const [draft, setDraft] = useState<Record<string, AchievementProgress>>({});
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    setDraft(loadAchievementProgress(storageKey));
    setSavedFlash(false);
  }, [storageKey]);

  if (!user) {
    return <Navigate to="/admin/achievements/users" replace />;
  }

  const setProgress = (id: string, value: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
    setDraft((prev) => ({
      ...prev,
      [id]: { progress: clamped },
    }));
  };

  const setCompleted = (id: string, completed: boolean) => {
    setDraft((prev) => ({
      ...prev,
      [id]: { completed },
    }));
  };

  const handleSave = () => {
    saveAchievementProgress(storageKey, draft);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  return (
    <SectionScreen title={user.nickname} backTo="/admin/achievements/users">
      <p className="text-center text-[12px] font-500 mb-5" style={{ color: '#6B6360' }}>
        {user.email}
      </p>

      <div className="space-y-3 mb-6">
        {ACHIEVEMENTS.map((achievement) => {
          const state = draft[achievement.id] ?? {};
          const hasTarget = achievement.target !== undefined;

          return (
            <div
              key={achievement.id}
              className="rounded-2xl px-4 py-3.5"
              style={{ background: '#231A16', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-white font-700 text-[14px] leading-tight">{achievement.title}</p>
              <p className="text-[11px] font-500 mt-0.5 mb-3" style={{ color: '#8c8c88' }}>
                {achievement.description}
              </p>

              {hasTarget ? (
                <label className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-600" style={{ color: '#A39B98' }}>
                    Прогресс / {achievement.target}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={achievement.target}
                    value={state.progress ?? 0}
                    onChange={(e) =>
                      setProgress(achievement.id, Number(e.target.value), achievement.target!)
                    }
                    className="w-24 rounded-lg px-3 py-2 text-right text-[14px] font-700 text-white outline-none"
                    style={{
                      background: '#110b09',
                      border: '1px solid rgba(217,153,98,0.35)',
                    }}
                  />
                </label>
              ) : (
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-[12px] font-600" style={{ color: '#A39B98' }}>
                    {state.completed ? 'Выполнено' : 'Не выполнено'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={state.completed === true}
                    onClick={() => setCompleted(achievement.id, !state.completed)}
                    className="relative w-12 h-7 rounded-full transition-colors"
                    style={{
                      background:
                        state.completed === true
                          ? 'linear-gradient(to right, #8C4C27, #D99962)'
                          : '#463129',
                    }}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
                        state.completed === true ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </label>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="w-full h-14 rounded-2xl text-[15px] font-bold tracking-wide text-[#0A0908] active:scale-[0.98] transition-transform"
        style={{
          background: 'linear-gradient(to right, #8C4C27, #D99962)',
          boxShadow: '0 0 24px rgba(217,153,98,0.32)',
        }}
      >
        {savedFlash ? 'Сохранено' : 'Сохранить'}
      </button>

      <button
        type="button"
        onClick={() => navigate('/admin/achievements/users')}
        className="w-full mt-3 py-3 text-[13px] font-600"
        style={{ color: '#8c8c88' }}
      >
        К списку пользователей
      </button>
    </SectionScreen>
  );
}
