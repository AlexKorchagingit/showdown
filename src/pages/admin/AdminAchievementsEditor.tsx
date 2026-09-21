import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { SectionScreen } from '../../components/SectionScreen';
import { ACHIEVEMENTS, type AchievementProgress } from '../../data/achievements';
import { useUser } from '../../context/UserContext';
import { ScreenLoading } from '../../components/ScreenLoading';
import { FetchErrorCard } from '../../components/FetchErrorCard';
import { readLegacyAchievementProgress } from '../../lib/achievementStorage';
import {
  fetchAchievementProgress,
  saveAchievementProgress,
  type AchievementProgressMap,
} from '../../lib/achievementsApi';

function sameProgress(left: AchievementProgressMap, right: AchievementProgressMap): boolean {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const id of ids) {
    const a = left[id] ?? {};
    const b = right[id] ?? {};
    if ((a.progress ?? 0) !== (b.progress ?? 0)) return false;
    if ((a.completed === true) !== (b.completed === true)) return false;
  }
  return true;
}

export function AdminAchievementsEditor() {
  const { userId } = useParams<{ userId: string }>();
  const { clubUsers, isLoading } = useUser();
  const user = useMemo(
    () => clubUsers.find((u) => u.id === userId),
    [clubUsers, userId],
  );

  const [draft, setDraft] = useState<AchievementProgressMap | null>(null);
  const [saved, setSaved] = useState<AchievementProgressMap | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fromDevice, setFromDevice] = useState(false);

  const targetId = user?.id ?? '';
  const targetEmail = user?.email ?? '';

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoadError('');
    setSaveError('');
    try {
      const remote = await fetchAchievementProgress(targetId);
      setSaved(remote);
      // Grants typed on this device before achievements moved to the server are
      // offered as an unsaved draft instead of being silently lost.
      const legacy = Object.keys(remote).length === 0
        ? readLegacyAchievementProgress(targetEmail)
        : {};
      setFromDevice(Object.keys(legacy).length > 0);
      setDraft(Object.keys(legacy).length > 0 ? legacy : remote);
    } catch (failure) {
      setSaved(null);
      setDraft(null);
      setLoadError(failure instanceof Error ? failure.message : 'Не удалось загрузить достижения');
    }
  }, [targetId, targetEmail]);

  useEffect(() => {
    setDraft(null);
    setSaved(null);
    void load();
  }, [load]);

  if (!user) {
    if (isLoading) {
      return (
        <SectionScreen title="Achievements" backTo="/admin/achievements/users">
          <ScreenLoading label="Загрузка пользователя…" />
        </SectionScreen>
      );
    }
    return <Navigate to="/admin/achievements/users" replace />;
  }

  const dirty = draft !== null && saved !== null && !sameProgress(draft, saved);

  const setProgress = (id: string, value: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, Number.isFinite(value) ? Math.trunc(value) : 0));
    setDraft((prev) => ({ ...prev, [id]: { progress: clamped } }));
  };

  const setCompleted = (id: string, completed: boolean) => {
    setDraft((prev) => ({ ...prev, [id]: { completed } }));
  };

  const save = () => {
    if (!draft || busy) return;
    setBusy(true);
    setSaveError('');
    void saveAchievementProgress(user.id, draft)
      .then((confirmed) => {
        setSaved(confirmed);
        setDraft(confirmed);
        setFromDevice(false);
      })
      .catch((failure: unknown) => {
        setSaveError(failure instanceof Error ? failure.message : 'Не удалось сохранить достижения');
      })
      .finally(() => setBusy(false));
  };

  return (
    <SectionScreen title={user.nickname} backTo="/admin/achievements/users">
      <p className="text-[12px] font-500 mb-3" style={{ color: '#6B6360' }}>
        {user.email}
      </p>

      {loadError ? (
        <FetchErrorCard message={loadError} onRetry={() => void load()} />
      ) : !draft ? (
        <ScreenLoading label="Загрузка достижений…" />
      ) : (
        <>
          {fromDevice ? (
            <p className="mb-3 rounded-xl px-4 py-3 text-[12px] font-500 leading-relaxed"
              style={{ background: 'rgba(217,153,98,0.12)', border: '1px solid rgba(217,153,98,0.3)', color: '#D99962' }}>
              Достижения из старой версии сохранены только на этом устройстве.
              Нажмите «Сохранить», чтобы игрок их увидел.
            </p>
          ) : null}

          <div className="space-y-3 pb-2">
            {ACHIEVEMENTS.map((achievement) => {
              const state: AchievementProgress = draft[achievement.id] ?? {};
              const hasTarget = achievement.target !== undefined;

              return (
                <div
                  key={achievement.id}
                  className="rounded-2xl px-4 py-3.5"
                  style={{ background: '#231A16', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-start gap-3">
                    {achievement.imageUrl ? (
                      <img
                        src={achievement.imageUrl}
                        alt=""
                        aria-hidden
                        className="w-10 h-10 shrink-0 object-contain mt-0.5"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 shrink-0 rounded-full mt-0.5"
                        style={{ background: '#110b09', border: '1px solid rgba(217,153,98,0.28)' }}
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-white font-700 text-[14px] leading-tight">{achievement.title}</p>
                      <p className="text-[11px] font-500 mt-0.5 mb-3" style={{ color: '#8c8c88' }}>
                        {achievement.description}
                      </p>
                    </div>
                  </div>

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

          {saveError ? (
            <p className="mt-3 text-[12px] font-600 text-red-400">{saveError}</p>
          ) : null}

          <div
            className="sticky bottom-0 -mx-5 mt-3 px-5 pt-3"
            style={{
              background: 'linear-gradient(to top, #110b09 60%, rgba(17,11,9,0))',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
            }}
          >
            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className="h-12 w-full rounded-xl text-[15px] font-700 text-[#0A0908] active:scale-[0.98] disabled:opacity-40"
              style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
            >
              {busy ? 'Сохраняем…' : dirty ? 'Сохранить' : 'Сохранено'}
            </button>
          </div>
        </>
      )}
    </SectionScreen>
  );
}
