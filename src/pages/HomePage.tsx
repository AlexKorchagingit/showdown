import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Phone,
  Info,
  MapPin,
  MessageCircle,
  Calendar,
  Clock,
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

function Header() {
  return (
    <header
      className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-3">
        <img
          src="/logo.svg"
          alt="SD"
          className="w-9 h-9"
          style={{ filter: 'drop-shadow(0 0 8px rgba(217,153,98,0.5))' }}
        />
        <span className="font-900 text-[17px] uppercase tracking-[0.18em]" style={{ color: '#F2D8A7' }}>
          Showdown
        </span>
      </div>

      {!isLoggedIn && (
        <div className="flex items-center gap-2">
          <button
            className="px-3.5 py-1.5 text-[13px] font-600 rounded-xl transition-opacity active:opacity-60"
            style={{ color: '#D99962' }}
          >
            Войти
          </button>
          <button
            className="px-3.5 py-1.5 text-[13px] font-700 text-white rounded-xl active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(to right, #8C4C27, #D99962)',
              boxShadow: '0 0 12px rgba(217,153,98,0.22)',
              color: '#0A0908',
            }}
          >
            Регистрация
          </button>
        </div>
      )}
    </header>
  );
}

// ─── Hero card (no footer strip) ─────────────────────────────────────────────

function HeroCard({ onPress }: { onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="w-full text-left rounded-2xl overflow-hidden active:scale-[0.984] transition-transform duration-150"
      style={{
        background: 'linear-gradient(135deg, #2A211D 0%, #1E1612 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
      }}
    >
      <div className="flex gap-4 p-5">
        {/* Left */}
        <div className="flex-1 flex flex-col gap-3.5 min-w-0">
          <div>
            <p className="text-[11px] font-600 uppercase tracking-[0.15em] mb-1.5" style={{ color: '#8C4C27' }}>
              Ближайший турнир
            </p>
            <h2 className="font-800 text-[18px] uppercase tracking-wider leading-tight text-white">
              {NEXT_TOURNAMENT.title}
            </h2>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[12px]" style={{ color: '#A39B98' }}>
              <Calendar size={12} style={{ color: '#c8a38e' }} />
              {NEXT_TOURNAMENT.date}
              <span className="opacity-40">·</span>
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
            className="self-start px-5 py-2 rounded-xl text-[13px] font-700 active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(to right, #8C4C27, #D99962)',
              boxShadow: '0 0 16px rgba(217,153,98,0.28)',
              color: '#0A0908',
            }}
          >
            Записаться
          </button>
        </div>

        {/* Right: decorative */}
        <div
          className="w-[96px] shrink-0 rounded-xl relative flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(160deg, #1A130F, #2d2020)' }}
        >
          {['♠','♥','♦','♣'].map((s, i) => (
            <span key={i} className="absolute select-none"
              style={{ color: '#c8a38e', opacity: 0.09,
                fontSize: `${18 + i * 7}px`,
                top: `${[8,42,60,22][i]}%`, left: `${[12,55,15,58][i]}%`,
                transform: `rotate(${[-10,15,-7,20][i]}deg)` }}>
              {s}
            </span>
          ))}
          <span className="text-[38px] relative z-10 leading-none" style={{ color: '#D99962', opacity: 0.5 }}>♠</span>
          <p className="relative z-10 text-[11px] font-700 uppercase tracking-wider mt-1" style={{ color: '#c8a38e' }}>
            1 500 ₽
          </p>
        </div>
      </div>
      {/* ← Footer strip removed */}
    </button>
  );
}

// ─── Podium ───────────────────────────────────────────────────────────────────

function PodiumPlayer({ player }: { player: (typeof PODIUM)[number] }) {
  const isFirst = player.rank === 1;
  const blockH  = { 1: 76, 2: 52, 3: 38 }[player.rank as 1|2|3];
  const blockBg = {
    1: { background: 'linear-gradient(to bottom, #D99962, #F2D8A7)' },
    2: { background: '#A39B98' },
    3: { background: '#8C4C27' },
  }[player.rank as 1|2|3];

  return (
    <div className="flex flex-col items-center gap-2" style={{ minWidth: 88 }}>
      {/* Avatar — no medal icons */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-700"
        style={isFirst
          ? { background: 'linear-gradient(135deg, #8C4C27, #F2D8A7)', color: '#0A0908',
              border: '2px solid rgba(242,216,167,0.55)', boxShadow: '0 0 14px rgba(242,216,167,0.28)' }
          : { background: '#2A211D', color: '#A39B98', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {player.name[0]}
      </div>

      <p className="text-[11px] font-500 text-center truncate w-full"
         style={{ color: isFirst ? '#F2D8A7' : '#A39B98' }}>
        {player.name.split(' ')[0]}
      </p>

      <p className="text-[12px] font-700" style={{ color: isFirst ? '#D99962' : '#6B6360' }}>
        {player.points.toLocaleString('ru-RU')}
      </p>

      {/* Podium block */}
      <div
        className="w-full rounded-t-lg flex items-center justify-center font-900 text-[15px]"
        style={{ height: blockH, color: '#0A0908', ...blockBg }}
      >
        {player.rank}
      </div>
    </div>
  );
}

function RatingSection({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="space-y-5">
      {/* Header — justify-start, big font, gold chevron */}
      <button
        onClick={onNavigate}
        className="flex items-center justify-start gap-3 active:opacity-70 transition-opacity"
      >
        <span className="text-2xl font-800 uppercase tracking-[0.15em] text-white">
          Рейтинг
        </span>
        <ChevronRight size={22} style={{ color: '#D99962' }} strokeWidth={2.5} />
      </button>

      {/* Podium — transparent background, sits on main dark bg */}
      <div className="flex items-end justify-center gap-3 px-2">
        {PODIUM.map((p) => (
          <PodiumPlayer key={p.rank} player={p} />
        ))}
      </div>
    </div>
  );
}

// ─── Info 2×2 grid — no subtitles, bigger labels ─────────────────────────────

const INFO_ITEMS = [
  { icon: Phone,         label: 'Поддержка' },
  { icon: Info,          label: 'О клубе'   },
  { icon: MapPin,        label: 'Адрес'     },
  { icon: MessageCircle, label: 'Q&A'       },
] as const;

function InfoGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {INFO_ITEMS.map(({ icon: Icon, label }) => (
        <button
          key={label}
          className="text-left rounded-2xl p-4 flex flex-col gap-3.5 active:brightness-125 transition-all"
          style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(140,76,39,0.2)' }}
          >
            <Icon size={17} style={{ color: '#D99962' }} />
          </div>
          {/* Only label, no subtitle */}
          <p className="text-[17px] font-700 text-white leading-snug">{label}</p>
        </button>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate();

  const goToTournament = () =>
    navigate('/tournaments', { state: { openTournamentId: NEXT_TOURNAMENT.id, from: '/' } });

  return (
    <div className="flex flex-col h-full bg-obsidian">
      <Header />

      <div className="flex-1 scrollable">
        <div className="px-5 pt-5 pb-5 space-y-6">
          {isLoggedIn && (
            <p className="text-[13px] font-500" style={{ color: '#A39B98' }}>
              Здравствуйте,{' '}
              <span className="font-700 text-white">{userName}</span>
            </p>
          )}

          <HeroCard onPress={goToTournament} />
          <RatingSection onNavigate={() => navigate('/rating')} />
          <InfoGrid />
          <div className="h-1" />
        </div>
      </div>
    </div>
  );
}
