import { useMemo } from 'react';
import { SectionScreen } from '../components/SectionScreen';
import { useUser } from '../context/UserContext';
import { isAchievementDone, type Achievement } from '../data/achievements';
import {
  loadAchievementProgress,
  resolveAchievements,
  sortAchievements,
} from '../lib/achievementStorage';

const DEFAULT_ART = '5.25rem';
const BIGGER_ART = '5.9rem';
const EXTRA_ART = '6.5rem';

/** Slightly larger badge art for selected achievements. */
const ART_SIZE: Record<string, string> = {
  paparazzi: '6.15rem',
  crucian: BIGGER_ART,
  punctual: BIGGER_ART,
  fish: BIGGER_ART,
  welcome: BIGGER_ART,
  shark: BIGGER_ART,
  predator: EXTRA_ART,
  'giant-slayer': EXTRA_ART,
  friend: BIGGER_ART,
  'four-kings': EXTRA_ART,
  'the-best': BIGGER_ART,
};

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const done = isAchievementDone(achievement);
  const target = achievement.target ?? 0;
  const progress = achievement.progress ?? 0;
  const hasProgressBar = target > 0;
  const percent = target > 0 ? Math.min(100, (progress / target) * 100) : 0;
  const artSize = ART_SIZE[achievement.id] ?? DEFAULT_ART;

  return (
    <div
      className={[
        'relative aspect-square rounded-xl p-2 flex flex-col justify-center items-center text-center overflow-hidden max-w-[160px] mx-auto w-full',
        hasProgressBar ? 'pr-4' : '',
        done
          ? 'bg-gradient-to-br from-[#463129] via-[#8C4C27]/40 to-[#231A16] border-2 border-[#D99962] shadow-[inset_0_0_15px_rgba(217,153,98,0.5)]'
          : 'bg-gradient-to-br from-[#231A16] to-[#110b09] border border-[#8C4C27]/30 shadow-inner',
      ].join(' ')}
    >
      {done && (
        <div className="absolute inset-0 rounded-xl pointer-events-none animate-pulse shadow-[inset_0_0_18px_rgba(217,153,98,0.55)] ring-1 ring-inset ring-[#D99962]/40" />
      )}

      {hasProgressBar && (
        <div className="absolute right-1.5 top-2 bottom-2 w-1.5 bg-black/60 rounded-full overflow-hidden z-10">
          <div
            className="absolute bottom-0 w-full bg-gradient-to-t from-[#8C4C27] to-[#F2D8A7] transition-all"
            style={{ height: `${percent}%` }}
          />
        </div>
      )}

      <div
        className="relative z-10 flex items-center justify-center shrink-0 mb-1"
        style={{ width: artSize, height: artSize }}
      >
        <img
          src={achievement.imageUrl}
          alt=""
          aria-hidden
          className={[
            'relative z-10 w-full h-full object-contain',
            done ? '' : 'opacity-55 grayscale-[0.35]',
          ].join(' ')}
        />
      </div>
      <div className="relative z-10 w-full min-h-0 px-0.5 overflow-hidden">
        <p
          className={[
            'font-black leading-tight text-[10px] line-clamp-2',
            'text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7]',
          ].join(' ')}
        >
          {achievement.title}
        </p>
        <p className="overflow-hidden text-white/55 text-ellipsis line-clamp-3 text-[9px] leading-tight mt-0.5">
          {achievement.description}
        </p>
      </div>
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
    <SectionScreen
      title="Достижения"
      backTo="/profile"
      centerTitle
      headerClassName="py-5"
      contentPaddingBottom="calc(env(safe-area-inset-bottom, 0px) + 8rem)"
      right={
        <span className="text-lg font-bold text-[#D99962] tabular-nums">
          {done}/{achievements.length}
        </span>
      }
    >
      <div className="-mx-5 grid grid-cols-2 gap-6 px-4 pb-32">
        {achievements.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </SectionScreen>
  );
}
