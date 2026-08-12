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

/** Slightly larger badge art for selected achievements. */
const ART_SIZE: Record<string, string> = {
  paparazzi: '6.15rem',
  crucian: BIGGER_ART,
  punctual: BIGGER_ART,
  fish: BIGGER_ART,
  welcome: BIGGER_ART,
  shark: BIGGER_ART,
  predator: BIGGER_ART,
  'giant-slayer': BIGGER_ART,
  friend: BIGGER_ART,
  'four-kings': BIGGER_ART,
  'the-best': BIGGER_ART,
};

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const done = isAchievementDone(achievement);
  const target = achievement.target ?? 0;
  const progress = achievement.progress ?? 0;
  const hasProgressBar = target > 0;
  const percent = target > 0 ? Math.min(100, (progress / target) * 100) : 0;
  const artSize = ART_SIZE[achievement.id] ?? DEFAULT_ART;
  const tightText = achievement.id === 'headhunter' || achievement.id === 'paparazzi';
  const singleLineTitle = achievement.id === 'paparazzi';
  const liftTitle = achievement.id === 'headhunter';

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

      <div
        className={[
          'relative z-10 flex items-center justify-center shrink-0',
          liftTitle ? 'mb-0' : 'mb-1',
        ].join(' ')}
        style={{ width: artSize, height: artSize }}
      >
        {done && (
          <span
            className="absolute inset-[-6%] rounded-full blur-lg animate-ach-glow pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(217,153,98,0.38) 0%, rgba(217,153,98,0.14) 48%, transparent 72%)',
            }}
          />
        )}
        <img
          src={achievement.imageUrl}
          alt=""
          aria-hidden
          className={[
            'relative z-10 w-full h-full object-contain',
            done ? 'drop-shadow-[0_0_4px_rgba(217,153,98,0.45)]' : 'opacity-55 grayscale-[0.35]',
          ].join(' ')}
        />
      </div>
      <p
        className={[
          'relative z-10 font-black leading-tight px-0.5',
          'text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7]',
          singleLineTitle ? 'text-[10px] whitespace-nowrap mb-0.5' : 'text-[11px] mb-0.5',
          liftTitle ? '-mt-1 mb-0' : '',
        ].join(' ')}
      >
        {achievement.title}
      </p>
      <p
        className={[
          'relative z-10 text-white/55 leading-tight px-0.5 overflow-hidden',
          tightText ? 'text-[7.5px] line-clamp-2' : 'text-[8px] line-clamp-3',
        ].join(' ')}
      >
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
