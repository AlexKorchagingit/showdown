import { useMemo } from 'react';
import { SectionScreen } from '../components/SectionScreen';
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
        'relative aspect-square rounded-xl p-2 flex flex-col justify-center items-center text-center overflow-hidden max-w-[160px] mx-auto w-full',
        hasProgressBar ? 'pr-4' : '',
        done
          ? 'bg-gradient-to-br from-[#463129] via-[#8C4C27]/40 to-[#231A16] border-2 border-[#D99962] shadow-[0_0_15px_rgba(217,153,98,0.5)]'
          : 'bg-gradient-to-br from-[#231A16] to-[#110b09] border border-[#8C4C27]/30 shadow-inner',
      ].join(' ')}
    >
      {done && (
        <div className="absolute -inset-[100%] bg-gradient-to-tr from-transparent via-white/5 to-transparent rotate-45 pointer-events-none" />
      )}

      {hasProgressBar && (
        <div className="absolute right-1.5 top-2 bottom-2 w-1.5 bg-black/60 rounded-full overflow-hidden z-10">
          <div
            className="absolute bottom-0 w-full bg-gradient-to-t from-[#8C4C27] to-[#F2D8A7] transition-all"
            style={{ height: `${percent}%` }}
          />
        </div>
      )}

      <img
        src={achievement.imageUrl}
        alt=""
        aria-hidden
        className={[
          'w-12 h-12 mb-1 shrink-0 relative z-10 object-contain',
          done
            ? 'drop-shadow-[0_0_6px_#D99962] scale-110'
            : 'opacity-55 grayscale-[0.35]',
        ].join(' ')}
      />
      <p className="relative z-10 text-[10px] font-bold text-white mb-0.5 leading-tight px-0.5">
        {achievement.title}
      </p>
      <p className="relative z-10 text-[8px] text-white/55 leading-tight px-0.5 line-clamp-3">
        {achievement.description}
      </p>
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
      <p className="text-center text-[12px] font-600 mb-4" style={{ color: '#8c8c88' }}>
        Получено{' '}
        <span className="font-bold" style={{ color: '#D99962' }}>
          {done}
        </span>{' '}
        из {achievements.length}
      </p>

      <div className="-mx-5 grid grid-cols-2 gap-6 px-4">
        {achievements.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </SectionScreen>
  );
}
