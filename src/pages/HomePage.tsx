import { useNavigate } from 'react-router-dom';
import { ChevronRight, Phone, Info, MapPin, MessageCircle, Calendar, Clock, ExternalLink } from 'lucide-react';
import { CURRENT_USER_RATING } from '../types/player';

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
const PODIUM = [
  { rank: 2, name: 'Дмитрий В.',   points: 3850, glowColor: '#8c8c88' },
  { rank: 1, name: 'Александр К.', points: 4200, glowColor: '#D99962' },
  { rank: 3, name: 'Михаил С.',    points: 3610, glowColor: '#8C4C27' },
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
          src="/logo-final.svg"
          alt="Showdown"
          className="h-10 w-auto object-contain"
          style={{ filter: 'drop-shadow(0 0 8px rgba(217,153,98,0.5))' }}
        />
        <span className="font-900 text-[17px] uppercase tracking-[0.18em]" style={{ color: '#F2D8A7' }}>
          Showdown
        </span>
      </div>
      {!isLoggedIn && (
        <div className="flex items-center gap-2">
          <button className="px-3.5 py-1.5 text-[13px] font-600 rounded-xl active:opacity-60"
                  style={{ color: '#D99962' }}>
            Войти
          </button>
          <button
            className="px-3.5 py-1.5 text-[13px] font-700 rounded-xl active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)', color: '#0A0908',
                     boxShadow: '0 0 12px rgba(217,153,98,0.22)' }}
          >
            Регистрация
          </button>
        </div>
      )}
    </header>
  );
}

// ─── Hero card (larger, more padding, bigger text) ───────────────────────────
function HeroCard({ onPress }: { onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="w-full text-left rounded-2xl overflow-hidden active:scale-[0.984] transition-transform duration-150"
      style={{
        background: 'linear-gradient(135deg, #463129 0%, #3a2720 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 28px rgba(0,0,0,0.5)',
        minHeight: 200,
      }}
    >
      <div className="flex gap-4 px-6 py-7">
        {/* Left */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div>
            <p className="text-[11px] font-600 uppercase tracking-[0.15em] mb-2" style={{ color: '#8C4C27' }}>
              Ближайший турнир
            </p>
            <h2 className="font-900 text-[22px] uppercase tracking-wider leading-tight text-white">
              {NEXT_TOURNAMENT.title}
            </h2>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[13px]" style={{ color: '#A39B98' }}>
              <Calendar size={13} style={{ color: '#c8a38e' }} />
              {NEXT_TOURNAMENT.date}
              <span className="opacity-30">·</span>
              <Clock size={13} style={{ color: '#c8a38e' }} />
              {NEXT_TOURNAMENT.time}
            </div>
            <div className="flex items-center gap-2 text-[12px]" style={{ color: '#6B6360' }}>
              <MapPin size={12} style={{ color: '#8C4C27' }} />
              <span className="truncate">{NEXT_TOURNAMENT.address}</span>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onPress(); }}
            className="self-start px-6 py-2.5 rounded-xl text-[14px] font-700 active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)',
                     boxShadow: '0 0 16px rgba(217,153,98,0.28)', color: '#0A0908' }}
          >
            Записаться
          </button>
        </div>

        {/* Right: decorative */}
        <div
          className="w-[100px] shrink-0 rounded-xl relative flex flex-col items-center justify-center"
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
          <span className="text-[40px] relative z-10 leading-none" style={{ color: '#D99962', opacity: 0.5 }}>♠</span>
          <p className="relative z-10 text-[11px] font-700 uppercase tracking-wider mt-1" style={{ color: '#c8a38e' }}>
            1 500 ₽
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Podium player with pulsing glow ─────────────────────────────────────────
function PodiumPlayer({ player }: { player: (typeof PODIUM)[number] }) {
  const isFirst = player.rank === 1;
  const blockH  = { 1: 76, 2: 52, 3: 38 }[player.rank as 1|2|3];
  const blockBg = {
    1: { background: 'linear-gradient(to bottom, #D99962, #F2D8A7)' },
    2: { background: '#A39B98' },
    3: { background: '#8C4C27' },
  }[player.rank as 1|2|3];

  const avatarStyle = isFirst
    ? { background: 'linear-gradient(135deg, #8C4C27, #F2D8A7)', color: '#0A0908',
        border: '2px solid rgba(242,216,167,0.55)' }
    : { background: '#2A211D', color: '#A39B98', border: '1px solid rgba(255,255,255,0.08)' };

  return (
    <div className="flex flex-col items-center gap-2" style={{ minWidth: 88 }}>
      {/* Avatar with pulsing glow ring */}
      <div className="relative">
        {/* Glow ring — pulses independently */}
        <div
          className="absolute rounded-full animate-pulse pointer-events-none"
          style={{
            inset: '-3px',
            boxShadow: `0 0 14px 5px ${player.glowColor}`,
            borderRadius: '50%',
          }}
        />
        <div
          className="relative w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-700 z-10"
          style={avatarStyle}
        >
          {player.name[0]}
        </div>
      </div>

      <p className="text-[11px] font-500 text-center truncate w-full"
         style={{ color: isFirst ? '#F2D8A7' : '#A39B98' }}>
        {player.name.split(' ')[0]}
      </p>

      <p className="text-[12px] font-700" style={{ color: isFirst ? '#D99962' : '#6B6360' }}>
        {player.points.toLocaleString('ru-RU')}
      </p>

      <div className="w-full rounded-t-lg flex items-center justify-center font-900 text-[15px]"
           style={{ height: blockH, color: '#0A0908', ...blockBg }}>
        {player.rank}
      </div>
    </div>
  );
}

// ─── Rating section ───────────────────────────────────────────────────────────
function RatingSection({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="space-y-4">
      {/* Title — smaller (text-xl) + gold chevron, justify-start */}
      <button onClick={onNavigate}
              className="flex items-center justify-start gap-2.5 active:opacity-70 transition-opacity">
        <span className="text-xl font-800 uppercase tracking-[0.15em] text-white">Рейтинг</span>
        <ChevronRight size={19} style={{ color: '#D99962' }} strokeWidth={2.5} />
      </button>

      {/* Podium — transparent bg */}
      <div className="flex items-end justify-center gap-3 px-2">
        {PODIUM.map((p) => <PodiumPlayer key={p.rank} player={p} />)}
      </div>

      {/* Current user — warm mid-tone gradient + gold border */}
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: 'linear-gradient(to right, #463129, #514f4c)',
          border: '1px solid #D99962',
        }}
      >
        {/* Position number — bright gold */}
        <span className="text-[14px] font-800 w-10 shrink-0" style={{ color: '#D99962' }}>
          #{CURRENT_USER_RATING.rank}
        </span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-700 shrink-0"
          style={{ background: 'rgba(217,153,98,0.18)', color: '#c8a38e' }}
        >
          {CURRENT_USER_RATING.initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-700 truncate text-white">
            {CURRENT_USER_RATING.nickname}
          </p>
        </div>
        <p className="text-[13px] font-700 shrink-0" style={{ color: '#F2D8A7' }}>
          {CURRENT_USER_RATING.points.toLocaleString('ru-RU')}
        </p>
      </div>
    </div>
  );
}

// ─── Info 2×2 grid — horizontal layout, gradient bg, no subtitles ─────────────
function InfoGrid() {
  const items = [
    { icon: Phone,         label: 'Поддержка', address: null, link: null },
    { icon: Info,          label: 'О клубе',   address: null, link: null },
    {
      icon: MapPin,
      label: 'Адрес',
      address: 'ул. Покровская, 1',
      link: 'Открыть в картах',
    },
    { icon: MessageCircle, label: 'Q&A',       address: null, link: null },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ icon: Icon, label, address, link }) => (
        <button
          key={label}
          className="text-left rounded-2xl p-4 active:brightness-110 transition-all"
          style={{
            /* Dark left → light right */
            background: 'linear-gradient(to right, #231A16, #463129)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {address ? (
            /* "Адрес" card — horizontal icon + right flex-col */
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: 'rgba(140,76,39,0.2)' }}>
                <Icon size={17} style={{ color: '#D99962' }} />
              </div>
              <div className="flex flex-col gap-0.5 pt-0.5">
                <p className="text-[15px] font-700 text-white leading-tight">{label}</p>
                <p className="text-[11px] font-500 leading-snug" style={{ color: '#8c8c88' }}>
                  {address}
                </p>
                <div className="flex items-center gap-1 mt-1" style={{ color: '#D99962' }}>
                  <ExternalLink size={10} />
                  <span className="text-[11px] font-600">{link}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Regular card — horizontal icon + label */
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: 'rgba(140,76,39,0.2)' }}>
                <Icon size={17} style={{ color: '#D99962' }} />
              </div>
              <p className="text-[15px] font-700 text-white leading-tight">{label}</p>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-obsidian">
      <Header />

      {/* Scrollable — padded bottom so floating nav doesn't cover content */}
      <div
        className="flex-1 scrollable"
        style={{ paddingBottom: '2rem' }}
      >
        <div className="px-5 pt-5 space-y-6">
          {isLoggedIn && (
            <p className="text-[13px] font-500" style={{ color: '#A39B98' }}>
              Здравствуйте,{' '}
              <span className="font-700 text-white">{userName}</span>
            </p>
          )}

          <HeroCard onPress={() =>
            navigate('/tournaments', { state: { openTournamentId: NEXT_TOURNAMENT.id, from: '/' } })
          } />

          <RatingSection onNavigate={() => navigate('/rating')} />
          <InfoGrid />

          {/* Extra space at bottom */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
