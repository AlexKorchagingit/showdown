import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Phone,
  Info,
  MapPin,
  MessageCircle,
  Calendar,
  Clock,
  ExternalLink,
} from 'lucide-react';

// ─── Mock state & data ────────────────────────────────────────────────────────
const isLoggedIn = false;
const userName   = 'Alex_King';

const NEXT_TOURNAMENT = {
  id:      '1',
  title:   'ROYAL FREEZEOUT',
  date:    '5 июля 2026',
  time:    '19:00',
  address: 'г. Брянск, ул. Покровская, 1',
};

// Podium order: [2nd, 1st, 3rd]
const PODIUM_PLAYERS = [
  { rank: 2, name: 'Дмитрий В.',   points: 3850 },
  { rank: 1, name: 'Александр К.', points: 4200 },
  { rank: 3, name: 'Михаил С.',    points: 3610 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo.svg"
        alt="Showdown"
        className="w-10 h-10 rounded-xl"
        style={{ filter: 'drop-shadow(0 0 6px rgba(217,153,98,0.4))' }}
      />
      <span
        className="font-black text-lg tracking-[0.15em] uppercase"
        style={{ color: '#F2D8A7' }}
      >
        Showdown
      </span>
    </div>
  );
}

function AuthButtons() {
  return (
    <div className="flex items-center gap-2">
      <button
        className="px-3 py-1.5 text-sm font-semibold rounded-xl transition-all active:scale-95"
        style={{ color: '#D99962' }}
      >
        Войти
      </button>
      <button
        className="px-3 py-1.5 text-sm font-bold text-white rounded-xl transition-all active:scale-95"
        style={{
          background: 'linear-gradient(to right, #8C4C27, #D99962)',
          boxShadow: '0 0 12px rgba(217,153,98,0.3)',
        }}
      >
        Регистрация
      </button>
    </div>
  );
}

function TournamentHeroCard({ onNavigate }: { onNavigate: () => void }) {
  return (
    <button
      onClick={onNavigate}
      className="w-full text-left rounded-2xl overflow-hidden active:scale-[0.98] transition-transform duration-150"
      style={{
        background: 'linear-gradient(135deg, #463129 0%, #3a2720 100%)',
        border: '1px solid #514f4c',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex gap-3 p-4">
        {/* Left: info */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#985c3a' }}>
              Ближайший турнир
            </p>
            <h2
              className="font-black text-xl leading-tight tracking-wide"
              style={{ color: '#F2D8A7' }}
            >
              {NEXT_TOURNAMENT.title}
            </h2>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs" style={{ color: '#8c8c88' }}>
              <Calendar size={12} style={{ color: '#c8a38e' }} />
              {NEXT_TOURNAMENT.date}
              <Clock size={12} style={{ color: '#c8a38e' }} className="ml-1" />
              {NEXT_TOURNAMENT.time}
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#858484' }}>
              <MapPin size={12} style={{ color: '#c8a38e' }} />
              <span className="truncate">{NEXT_TOURNAMENT.address}</span>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
            className="self-start px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
            style={{
              background: 'linear-gradient(to right, #8C4C27, #D99962)',
              boxShadow: '0 0 14px rgba(217,153,98,0.35)',
            }}
          >
            Участвовать
          </button>
        </div>

        {/* Right: image placeholder */}
        <div
          className="w-28 shrink-0 rounded-xl overflow-hidden flex flex-col items-center justify-center gap-2 relative"
          style={{ background: 'linear-gradient(135deg, #2d1a10, #50444c)' }}
        >
          {/* Decorative suits */}
          {['♠', '♥', '♦', '♣'].map((s, i) => (
            <span
              key={i}
              className="absolute select-none"
              style={{
                color: '#c8a38e',
                opacity: 0.12,
                fontSize: `${20 + i * 8}px`,
                top: `${[5, 40, 60, 25][i]}%`,
                left: `${[10, 55, 15, 60][i]}%`,
                transform: `rotate(${[-12, 18, -8, 22][i]}deg)`,
              }}
            >
              {s}
            </span>
          ))}
          <span className="text-4xl relative z-10" style={{ color: '#D99962', opacity: 0.6 }}>
            ♠
          </span>
          <p
            className="relative z-10 text-[10px] font-bold uppercase tracking-wider text-center px-2 leading-tight"
            style={{ color: '#c8a38e' }}
          >
            Buy-in<br />1500 ₽
          </p>
        </div>
      </div>

      {/* Bottom strip */}
      <div
        className="px-4 py-2 flex items-center justify-between text-xs"
        style={{
          borderTop: '1px solid rgba(81,79,76,0.5)',
          color: '#69584f',
        }}
      >
        <span>Freezeout · 36 мест</span>
        <div className="flex items-center gap-1" style={{ color: '#D99962' }}>
          Подробнее <ChevronRight size={13} />
        </div>
      </div>
    </button>
  );
}

function PodiumBlock({
  player,
  isFirst,
}: {
  player: (typeof PODIUM_PLAYERS)[number];
  isFirst: boolean;
}) {
  const heights   = { 1: 80, 2: 56, 3: 40 };
  const blockH    = heights[player.rank as 1 | 2 | 3];
  const bgStyles  = {
    1: { background: 'linear-gradient(to bottom, #D99962, #F2D8A7)' },
    2: { background: '#8c8c88' },
    3: { background: '#8C4C27' },
  }[player.rank as 1 | 2 | 3];

  const badges = { 1: '👑', 2: '🥈', 3: '🥉' };

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width: 90 }}>
      {/* Crown / badge */}
      {isFirst && (
        <span className="text-xl mb-0.5">{badges[1]}</span>
      )}

      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
        style={{
          background: isFirst
            ? 'linear-gradient(135deg, #8C4C27, #F2D8A7)'
            : 'rgba(81,79,76,0.8)',
          color: isFirst ? '#110b09' : '#8c8c88',
          border: isFirst ? '2px solid #F2D8A7' : '1px solid #514f4c',
          boxShadow: isFirst ? '0 0 12px rgba(242,216,167,0.4)' : 'none',
        }}
      >
        {player.name[0]}
      </div>

      {/* Name */}
      <p
        className="text-[11px] font-medium text-center leading-tight w-full truncate"
        style={{ color: isFirst ? '#F2D8A7' : '#8c8c88' }}
      >
        {player.name.split(' ')[0]}
      </p>

      {/* Points */}
      <p
        className="text-xs font-bold"
        style={{ color: isFirst ? '#D99962' : '#69584f' }}
      >
        {player.points.toLocaleString('ru-RU')}
      </p>

      {!isFirst && (
        <span className="text-base">{badges[player.rank as 2 | 3]}</span>
      )}

      {/* Podium block */}
      <div
        className="w-full rounded-t-xl flex items-center justify-center font-black text-sm"
        style={{ height: blockH, ...bgStyles, color: '#110b09', opacity: 0.9 }}
      >
        {player.rank}
      </div>
    </div>
  );
}

function RatingSection({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="space-y-3">
      {/* Header row */}
      <button
        onClick={onNavigate}
        className="w-full flex items-center justify-between active:opacity-70 transition-opacity"
      >
        <span className="text-base font-bold uppercase tracking-widest" style={{ color: '#D99962' }}>
          Рейтинг
        </span>
        <ChevronRight size={18} style={{ color: '#D99962' }} />
      </button>

      {/* Podium */}
      <div
        className="rounded-2xl px-4 pt-4 pb-0 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #463129 0%, #3a2720 100%)',
          border: '1px solid #514f4c',
        }}
      >
        <div className="flex items-end justify-center gap-2">
          {PODIUM_PLAYERS.map((p) => (
            <PodiumBlock key={p.rank} player={p} isFirst={p.rank === 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

const INFO_CARDS = [
  {
    icon: Phone,
    label: 'Поддержка',
    sub: 'Написать нам',
    action: null,
  },
  {
    icon: Info,
    label: 'О клубе',
    sub: 'Узнать больше',
    action: null,
  },
  {
    icon: MapPin,
    label: 'Адрес',
    sub: 'ул. Покровская, 1',
    action: 'Открыть в картах',
  },
  {
    icon: MessageCircle,
    label: 'Q&A',
    sub: 'Часто задаваемые',
    action: null,
  },
];

function InfoGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {INFO_CARDS.map(({ icon: Icon, label, sub, action }) => (
        <button
          key={label}
          className="text-left rounded-2xl p-4 flex flex-col gap-2.5 active:brightness-110 transition-all"
          style={{
            background: '#463129',
            border: '1px solid rgba(81,79,76,0.6)',
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(140,76,39,0.25)' }}
          >
            <Icon size={18} style={{ color: '#c8a38e' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{label}</p>
            <p className="text-xs mt-0.5" style={{ color: '#8c8c88' }}>
              {sub}
            </p>
          </div>
          {action && (
            <div className="flex items-center gap-1 text-xs font-semibold mt-auto" style={{ color: '#D99962' }}>
              <ExternalLink size={11} />
              {action}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate();

  const goToTournament = () =>
    navigate('/tournaments', { state: { openTournamentId: NEXT_TOURNAMENT.id } });

  const goToRating = () => navigate('/rating');

  return (
    <div className="flex flex-col h-full bg-obsidian">
      {/* ── Header ── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(81,79,76,0.4)' }}
      >
        <Logo />
        {!isLoggedIn && <AuthButtons />}
      </header>

      {/* ── Scrollable body ── */}
      <div className="flex-1 scrollable px-4 pt-4 pb-4 space-y-5">
        {/* Welcome (only when logged in) */}
        {isLoggedIn && (
          <p className="text-sm" style={{ color: '#8c8c88' }}>
            Здравствуйте,{' '}
            <span className="font-bold" style={{ color: '#F2D8A7' }}>
              {userName}
            </span>
          </p>
        )}

        {/* Hero tournament card */}
        <TournamentHeroCard onNavigate={goToTournament} />

        {/* Rating podium */}
        <RatingSection onNavigate={goToRating} />

        {/* Info 2×2 grid */}
        <InfoGrid />

        {/* Bottom breathing room */}
        <div className="h-2" />
      </div>
    </div>
  );
}
