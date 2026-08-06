import { useMemo } from 'react';
import { SectionScreen } from '../components/SectionScreen';
import { SteampunkAchievementIcon } from '../components/SteampunkAchievementIcon';
import { useUser } from '../context/UserContext';
import { isAchievementDone, type Achievement } from '../data/achievements';
import {
  loadAchievementProgress,
  resolveAchievements,
  sortAchievements,
} from '../lib/achievementStorage';

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const done = isAchievementDone(achievement);
  const target = achievement.target ?? 0;
  const progress = achievement.progress ?? 0;
  const hasProgressBar = target > 0;
  const percent = target > 0 ? Math.min(100, (progress / target) * 100) : 0;

  return (
    <div
      className={[
        'relative aspect-square bg-[#231A16] rounded-xl border border-white/5 p-2',
        'flex flex-col justify-center items-center text-center overflow-hidden',
        hasProgressBar ? 'pr-5' : '',
        done
          ? 'ring-2 ring-[#D99962] shadow-[0_0_16px_rgba(217,153,98,0.35)] bg-gradient-to-br from-[#463129] to-[#231A16]'
          : '',
      ].join(' ')}
    >
      {hasProgressBar && (
        <div className="absolute right-1.5 top-2.5 bottom-2.5 w-1.5 bg-black/60 rounded-full overflow-hidden">
          <div
            className="absolute bottom-0 w-full bg-gradient-to-t from-[#8C4C27] to-[#F2D8A7] transition-all"
            style={{ height: `${percent}%` }}
          />
        </div>
      )}

      <SteampunkAchievementIcon id={achievement.id} className="w-12 h-12 mb-1.5 shrink-0" />
      <p className="text-xs font-bold text-white mb-0.5 leading-tight px-0.5">{achievement.title}</p>
      <p className="text-[9px] text-white/60 leading-tight px-0.5">{achievement.description}</p>
    </div>
  );
}

export function AchievementsScreen() {
  const { email } = useUser();

  const achievements = useMemo(() => {
    const progress = loadAchievementProgress(email);
    return sortAchievements(resolveAchievements(progress));
  }, [email]);

  const done = achievements.filter(isAchievementDone).length;

  return (
    <SectionScreen title="Достижения" backTo="/profile">
      <p className="text-center text-[12px] font-600 mb-3" style={{ color: '#8c8c88' }}>
        Получено{' '}
        <span className="font-bold" style={{ color: '#D99962' }}>
          {done}
        </span>{' '}
        из {achievements.length}
      </p>

      <div className="-mx-5 grid grid-cols-2 gap-2.5 px-4">
        {achievements.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </SectionScreen>
  );
}
