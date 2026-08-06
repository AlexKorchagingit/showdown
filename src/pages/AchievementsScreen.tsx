import { useMemo } from 'react';
import {
  Award,
  Bomb,
  Camera,
  Crown,
  Diamond,
  Fish,
  Flame,
  Ghost,
  Handshake,
  House,
  Medal,
  Skull,
  Sparkles,
  Spade,
  Swords,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { SectionScreen } from '../components/SectionScreen';
import { useUser } from '../context/UserContext';
import {
  isAchievementDone,
  type Achievement,
  type AchievementIcon,
} from '../data/achievements';
import {
  loadAchievementProgress,
  resolveAchievements,
  sortAchievements,
} from '../lib/achievementStorage';

const ICONS: Record<AchievementIcon, LucideIcon> = {
  fish: Fish,
  shark: Waves,
  megalodon: Skull,
  welcome: Sparkles,
  crown: Crown,
  bounty: Target,
  predator: Flame,
  hunter: Swords,
  winner: Trophy,
  royal: Diamond,
  straight: TrendingUp,
  quads: Spade,
  ranked: Medal,
  finalist: Award,
  photo: Camera,
  bubble: Ghost,
  friend: Handshake,
  resident: House,
  punctual: Timer,
  giantslayer: Bomb,
};

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const Icon = ICONS[achievement.icon];
  const done = isAchievementDone(achievement);
  const target = achievement.target ?? 0;
  const progress = achievement.progress ?? 0;
  const hasProgressBar = target > 0;
  const percent = target > 0 ? Math.min(100, (progress / target) * 100) : 0;

  return (
    <div
      className={[
        'relative aspect-square bg-[#231A16] rounded-xl border border-white/5 p-3',
        'flex flex-col justify-center items-center text-center overflow-hidden',
        hasProgressBar ? 'pr-6' : '',
        done
          ? 'ring-2 ring-[#D99962] shadow-[0_0_20px_rgba(217,153,98,0.4)] bg-gradient-to-br from-[#463129] to-[#231A16]'
          : '',
      ].join(' ')}
    >
      {hasProgressBar && (
        <div className="absolute right-2 top-3 bottom-3 w-2 bg-black/60 rounded-full overflow-hidden">
          <div
            className="absolute bottom-0 w-full bg-gradient-to-t from-[#8C4C27] to-[#F2D8A7] transition-all"
            style={{ height: `${percent}%` }}
          />
        </div>
      )}

      <Icon
        className="w-14 h-14 text-[#D99962] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-2"
        strokeWidth={1.8}
      />
      <p className="text-sm font-bold text-white mb-1 leading-tight">{achievement.title}</p>
      <p className="text-[10px] text-white/60 leading-tight">{achievement.description}</p>
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

      <div className="-mx-5 grid grid-cols-2 gap-4 px-4">
        {achievements.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </SectionScreen>
  );
}
