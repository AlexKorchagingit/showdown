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

// ─── Mock data ────────────────────────────────────────────────────────────────
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
const PODIUM = [
  { rank: 2, name: 'Дмитрий В.',   points: 3850 },
  { rank: 1, name: 'Александр К.', points: 4200 },
  { rank: 3, name: 'Михаил С.',    points: 3610 },
];

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ onLogin }: { onLogin?: () => void }) {
  return (
    <header
      className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <img
          src="/logo.svg"
          alt="SD"
          className="w-9 h-9"
          style={{ filter: 'drop-shadow(0 0 8px rgba(217,153,98,0.5))' }}
        />
        <span
          className="font-black text-[17px] uppercase tracking-[0.18em]"
          style={{ color: '#F2D8A7' }}
        >
          Showdown
        </span>
      </div>

      {/* Auth buttons — hidden when logged in */}
      {!isLoggedIn && (
        <div className="flex items-center gap-2">
          <button
            className="px-3.5 py-1.5 text-[13px] font-600 rounded-xl transition-opacity active:opacity-60"
            style={{ color: '#D99962' }}
          >
            Войти
          </button>
          <button
            className="px-3.5 py-1.5 text-[13px] font-700 text-white rounded-xl transition-all active:scale-95"
            style={{
              background: 'linear-gradient(to right, #8C4C27, #D99962)',
              boxShadow: '0 0 12px rgba(217,153,98,0.25)',
            }}
            onClick={onLogin}
          >
            Регистрация
          </button>
        </div>
      )}
    </header>
  );
}

// ─── Hero tournament card ─────────────────────────────────────────────────────

function HeroCard({ onPress }: { onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="w-full text-left rounded-2xl overflow-hidden active:scale-[0.985] transition-transform duration-150"
      style={{
        background: 'linear-gradient(135deg, #2A211D 0%, #1E1612 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex gap-4 p-5">
        {/* Left: text info */}
        <div className="flex-1 flex flex-col gap-3.5 min-w-0">
          <div>
            <p
              className="text-[11px] font-600 uppercase tracking-[0.15em] mb-1.5"
              style={{ color: '#8C4C27' }}
            >
              Ближайший турнир
            </p>
            <h2
              className="font-800 text-[18px] uppercase tracking-wider leading-tight text-white"
            >
              {NEXT_TOURNAMENT.title}
            </h2>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[12px]" style={{ color: '#A39B98' }}>
              <Calendar size={12} style={{ color: '#c8a38e' }} />
              {NEXT_TOURNAMENT.date}
              <span className="mx-0.5 opacity-40">·</span>
              <Clock size={12} style={{ color: '#c8a38e' }} />
              {NEXT_TOURNAMENT.time}
            </div>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: '#6B6360' }}>
              <MapPin size={11} style={{ color: '#8C4C27' }} />
              <span className="truncate">{NEXT_TOURNAMENT.address}</span>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onPress(); }}
            className="self-start px-5 py-2 rounded-xl text-[13px] font-700 text-obsidian transition-all active:scale-95"
            style={{
              background: 'linear-gradient(to right, #8C4C27, #D99962)',
              boxShadow: '0 0 16px rgba(217,153,98,0.3)',
              color: '#0A0908',
            }}
          >
            Записаться
          </button>
        </div>

        {/* Right: decorative image area */}
        <div
          className="w-[100px] shrink-0 rounded-xl overflow-hidden relative flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(160deg, #1A130F, #2d2020)' }}
        >
          {['♠','♥','♦','♣'].map((s, i) => (
            <span
              key={i}
              className="absolute select-none"
              style={{
                color: '#c8a38e', opacity: 0.1,
                fontSize: `${18 + i * 7}px`,
                top: `${[8, 42, 60, 22][i]}%`,
                left: `${[12, 55, 15, 58][i]}%`,
                transform: `rotate(${[-10,15,-7,20][i]}deg)`,
              }}
            >
              {s}
            </span>
          ))}
          <span
            className="text-[38px] relative z-10 leading-none"
            style={{ color: '#D99962', opacity: 0.55 }}
          >
            ♠
          </span>
          <p
            className="relative z-10 text-[11px] font-700 uppercase tracking-wider mt-1 text-center"
            style={{ color: '#c8a38e' }}
          >
            1 500 ₽
          </p>
        </div>
      </div>

      {/* Footer strip */}
      <div
        className="px-5 py-2.5 flex items-center justify-between text-[11px]"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          color: '#6B6360',
        }}
      >
        <span>Freezeout · 36 мест</span>
        <span className="flex items-center gap-1" style={{ color: '#D99962' }}>
          Подробнее <ChevronRight size={13} />
        </span>
      </div>
    </button>
  );
}

// ─── Podium ───────────────────────────────────────────────────────────────────

function PodiumPlayer({ player }: { player: (typeof PODIUM)[number] }) {
  const isFirst = player.rank === 1;

  const blockH = { 1: 76, 2: 52, 3: 38 }[player.rank as 1|2|3];
  const blockStyle = {
    1: { background: 'linear-gradient(to bottom, #D99962, #F2D8A7)' },
    2: { background: '#A39B98' },
    3: { background: '#8C4C27' },
  }[player.rank as 1|2|3];

  return (
    <div className="flex flex-col items-center gap-2" style={{ minWidth: 88 }}>
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-700"
        style={
          isFirst
            ? {
                background: 'linear-gradient(135deg, #8C4C27, #F2D8A7)',
                color: '#0A0908',
                border: '2px solid rgba(242,216,167,0.6)',
                boxShadow: '0 0 14px rgba(242,216,167,0.3)',
              }
            : {
                background: '#2A211D',
                color: '#A39B98',
                border: '1px solid rgba(255,255,255,0.08)',
              }
        }
      >
        {player.name[0]}
      </div>

      {/* Name */}
      <p
        className="text-[11px] font-500 text-center leading-tight truncate w-full"
        style={{ color: isFirst ? '#F2D8A7' : '#A39B98' }}
      >
        {player.name.split(' ')[0]}
      </p>

      {/* Points */}
      <p
        className="text-[12px] font-700"
        style={{ color: isFirst ? '#D99962' : '#6B6360' }}
      >
        {player.points.toLocaleString('ru-RU')}
      </p>

      {/* Podium block */}
      <div
        className="w-full rounded-t-lg flex items-center justify-center font-900 text-[15px]"
        style={{ height: blockH, color: '#0A0908', ...blockStyle }}
      >
        {player.rank}
      </div>
    </div>
  );
}

function RatingSection({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="space-y-4">
      {/* Header row — justify-start, gold chevron */}
      <button
        onClick={onNavigate}
        className="flex items-center justify-start gap-2 active:opacity-70 transition-opacity"
      >
        <span
          className="text-[13px] font-700 uppercase tracking-[0.2em]"
          style={{ color: '#D99962' }}
        >
          Рейтинг
        </span>
        <ChevronRight size={16} style={{ color: '#D99962' }} strokeWidth={2.5} />
      </button>

      {/* Podium — transparent background, sits on main bg */}
      <div className="flex items-end justify-center gap-3 px-2">
        {PODIUM.map((p) => (
          <PodiumPlayer key={p.rank} player={p} />
        ))}
      </div>
    </div>
  );
}

// ─── Info grid ────────────────────────────────────────────────────────────────

const INFO_ITEMS = [
  { icon: Phone,         label: 'Поддержка',  sub: 'Написать нам',    action: null },
  { icon: Info,          label: 'О клубе',    sub: 'Узнать больше',   action: null },
  {
    icon: MapPin,
    label: 'Адрес',
    sub:   'ул. Покровская, 1',
    action: 'Открыть в картах',
  },
  {
    icon: MessageCircle,
    label: 'Часто задаваемые вопросы',
    sub:   'Популярные темы',
    action: null,
  },
] as const;

function InfoGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {INFO_ITEMS.map(({ icon: Icon, label, sub, action }) => (
        <button
          key={label}
          className="text-left rounded-2xl p-4 flex flex-col gap-3 active:brightness-125 transition-all"
          style={{
            background: '#2A211D',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(140,76,39,0.2)' }}
          >
            <Icon size={17} style={{ color: '#D99962' }} />
          </div>

          {/* Text */}
          <div className="flex flex-col gap-0.5">
            <p
              className="font-700 leading-snug"
              style={{
                color: '#ffffff',
                fontSize: label.length > 12 ? '11px' : '13px',
              }}
            >
              {label}
            </p>
            <p className="text-[11px] font-400" style={{ color: '#A39B98' }}>
              {sub}
            </p>
          </div>

          {/* Link */}
          {action && (
            <div
              className="flex items-center gap-1 text-[11px] font-600 mt-auto"
              style={{ color: '#D99962' }}
            >
              <ExternalLink size={11} />
              {action}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate();

  const goToTournament = () =>
    navigate('/tournaments', {
      state: { openTournamentId: NEXT_TOURNAMENT.id, from: '/' },
    });

  return (
    <div className="flex flex-col h-full bg-obsidian">
      <Header />

      <div className="flex-1 scrollable">
        <div className="px-5 pt-5 pb-5 space-y-6">
          {/* Welcome */}
          {isLoggedIn && (
            <p className="text-[13px] font-500" style={{ color: '#A39B98' }}>
              Здравствуйте,{' '}
              <span className="font-700 text-white">{userName}</span>
            </p>
          )}

          {/* Hero tournament card */}
          <HeroCard onPress={goToTournament} />

          {/* Rating + podium */}
          <RatingSection onNavigate={() => navigate('/rating')} />

          {/* Info 2×2 */}
          <InfoGrid />

          <div className="h-1" />
        </div>
      </div>
    </div>
  );
}
