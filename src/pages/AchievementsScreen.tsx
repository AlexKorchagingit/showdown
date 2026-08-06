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
  Star,
  Swords,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { SectionScreen } from '../components/SectionScreen';
import {
  ACHIEVEMENTS,
  isAchievementDone,
  type Achievement,
  type AchievementIcon,
  type AchievementTier,
} from '../data/achievements';

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

const TIER_COLOR: Record<AchievementTier, { icon: string; bg: string; border: string }> = {
  gold:   { icon: '#F2D8A7', bg: 'rgba(217,153,98,0.16)',  border: 'rgba(217,153,98,0.45)' },
  silver: { icon: '#C9CBD1', bg: 'rgba(201,203,209,0.12)', border: 'rgba(201,203,209,0.32)' },
  ruby:   { icon: '#E0596B', bg: 'rgba(224,89,107,0.14)',  border: 'rgba(224,89,107,0.4)' },
};

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const Icon = ICONS[achievement.icon];
  const tier = TIER_COLOR[achievement.tier];
  const done = isAchievementDone(achievement);

  const hasProgress = achievement.target !== undefined && !done;
  const progress = achievement.progress ?? 0;
  const target = achievement.target ?? 0;
  const percent = target > 0 ? Math.min(100, (progress / target) * 100) : 0;

  return (
    <div
      className={`bg-[#231A16] rounded-xl p-4 flex flex-row gap-4 items-center mb-3 ${
        done ? '' : 'opacity-90'
      }`}
      style={{ border: `1px solid ${done ? tier.border : 'rgba(255,255,255,0.06)'}` }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: tier.bg, border: `1px solid ${tier.border}` }}
      >
        <Icon size={22} strokeWidth={2.1} style={{ color: done ? tier.icon : '#6B6360' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-white leading-tight">{achievement.title}</p>
        <p className="text-[12px] font-400 leading-snug mt-0.5" style={{ color: '#8c8c88' }}>
          {achievement.description}
        </p>
      </div>

      {done ? (
        <div className="shrink-0 flex flex-col items-center gap-1 w-[72px]">
          <Trophy size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
          <span className="text-[10px] font-700 uppercase tracking-wide" style={{ color: '#D99962' }}>
            Получено
          </span>
        </div>
      ) : hasProgress ? (
        <div className="shrink-0 w-[72px]">
          <div className="h-1.5 rounded-full overflow-hidden bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${percent}%`,
                background: 'linear-gradient(to right, #8C4C27, #D99962)',
              }}
            />
          </div>
          <p className="text-[11px] font-600 text-center mt-1.5 tabular-nums" style={{ color: '#A39B98' }}>
            {progress} / {target}
          </p>
        </div>
      ) : (
        <div className="shrink-0 w-[72px] flex justify-center">
          <Star size={20} strokeWidth={2} style={{ color: '#463129' }} />
        </div>
      )}
    </div>
  );
}

export function AchievementsScreen() {
  const done = ACHIEVEMENTS.filter(isAchievementDone).length;

  return (
    <SectionScreen title="Достижения" backTo="/profile">
      <p className="text-center text-[12px] font-600 mb-4" style={{ color: '#8c8c88' }}>
        Получено{' '}
        <span className="font-bold" style={{ color: '#D99962' }}>
          {done}
        </span>{' '}
        из {ACHIEVEMENTS.length}
      </p>

      {ACHIEVEMENTS.map((achievement) => (
        <AchievementCard key={achievement.id} achievement={achievement} />
      ))}
    </SectionScreen>
  );
}
