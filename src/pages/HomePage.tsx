import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronRight, MapPin, Calendar, Clock, Phone, Info, MessageCircle,
  ExternalLink, Mail, X, Send,
} from 'lucide-react';
import { useTournaments } from '../context/TournamentContext';
import { compareByStart, isFinished } from '../lib/tournamentStatus';
import { asset } from '../lib/assets';
import { CLUB_ADDRESS_CITY, CLUB_ADDRESS_STREET } from '../lib/clubAddress';
import { CURRENT_USER_RATING } from '../types/player';
import type { Tournament } from '../types/tournament';

// ─── Mock state ───────────────────────────────────────────────────────────────

const PODIUM = [
  { rank: 2, name: 'Дмитрий В.',   points: 3850, glowColor: '#8c8c88' },
  { rank: 1, name: 'Александр К.', points: 4200, glowColor: '#D99962' },
  { rank: 3, name: 'Михаил С.',    points: 3610, glowColor: '#8C4C27' },
];

const TELEGRAM_URL = 'https://t.me/showdown_bryansk';

function InstagramIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ModalShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-root"
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            key="modal-card"
            className="w-full max-w-[400px] rounded-2xl p-5 bg-[#231A16] border border-[#D99962]/30"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-800 text-white tracking-wide">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-70"
                style={{ background: 'rgba(17,11,9,0.7)', border: '1px solid rgba(217,153,98,0.3)' }}
              >
                <X size={18} className="text-[#D99962]" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SocialLinkRow({
  href,
  icon,
  label,
  subtitle,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  subtitle?: string;
}) {
  const isLink = href && href !== '#';
  const className =
    'w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left active:scale-[0.99] transition-transform';
  const style = {
    background: 'linear-gradient(to right, #1A1210, #2A211D)',
    border: '1px solid rgba(217,153,98,0.22)',
  } as const;

  const content = (
    <>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(217,153,98,0.12)', border: '1px solid rgba(217,153,98,0.3)' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-700 text-white truncate">{label}</p>
        {subtitle && (
          <p className="text-[12px] font-500 truncate" style={{ color: '#D99962' }}>
            {subtitle}
          </p>
        )}
      </div>
    </>
  );

  if (isLink) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {content}
      </a>
    );
  }

  return (
    <div className={className} style={{ ...style, opacity: 0.72 }}>
      {content}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ onOpenSocials }: { onOpenSocials: () => void }) {
  return (
    <header
      className="flex-shrink-0 flex items-center justify-between px-5 py-2"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-3">
        <img
          src={asset("/logo-final.webp")}
          alt="Showdown"
          className="h-16 w-auto object-contain"
          style={{ filter: 'drop-shadow(0 0 8px rgba(217,153,98,0.5))' }}
        />
        <span className="font-900 text-[17px] uppercase tracking-[0.18em]" style={{ color: '#F2D8A7' }}>
          Showdown
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenSocials}
        aria-label="Мы в соцсетях"
        className="relative flex items-center -space-x-6 pr-1 active:scale-95 transition-transform"
      >
        <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[#1D4ED8] border-[3px] border-[#110b09] z-[1]">
          <Send size={15} strokeWidth={2.2} className="text-white" />
        </span>
        <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[#DB2777] border-[3px] border-[#110b09] z-[2]">
          <InstagramIcon size={15} className="text-white" />
        </span>
        <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[#2563EB] border-[3px] border-[#110b09] z-10 text-[10px] font-bold text-white">
          VK
        </span>
      </button>
    </header>
  );
}

// ─── Hero card — layered design with background image ────────────────────────
function HeroCard({ tournament, onPress }: { tournament: Tournament; onPress: () => void }) {
  const dateObj = new Date(tournament.startDate);
  const weekday = dateObj.toLocaleDateString('ru-RU', { weekday: 'long' });
  const dayMonth = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const dateStr = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dayMonth}`;

  return (
    <button
      onClick={onPress}
      className="relative w-full text-left rounded-2xl overflow-hidden active:scale-[0.984] transition-transform duration-150"
      style={{
        background: '#1d0b07',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 28px rgba(0,0,0,0.55)',
        minHeight: 168,
      }}
    >
      {/* Fully transparent art wrapper — no bg / border / ring / shadow */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-transparent border-0 shadow-none ring-0 outline-none">
        <img
          src={tournament.imageUrl}
          alt=""
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2 right-[-5%] h-[130%] w-auto max-w-none object-right object-contain pointer-events-none select-none origin-right scale-100 bg-transparent border-0 shadow-none ring-0 outline-none"
          style={{
            opacity: 0.85,
            filter: 'brightness(1.08) contrast(1.04) saturate(1.04)',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            background: 'transparent',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black)',
            maskImage: 'linear-gradient(to right, transparent, black)',
          }}
        />
        <div className="absolute inset-0 pointer-events-none border-0 shadow-none ring-0 bg-gradient-to-r from-[#1d0b07] from-[30%] via-[#1d0b07]/60 via-[50%] to-transparent" />
      </div>

      {/* Text content — over gradient */}
      <div className="relative z-20 flex flex-col gap-3 px-5 py-5" style={{ width: '68%' }}>
        <div>
          <p
            className="text-[10px] font-bold tracking-widest uppercase mb-1.5"
            style={{ color: '#D99962' }}
          >
            Ближайший турнир
          </p>
          <h2 className="text-2xl font-black text-white uppercase leading-tight" style={{ letterSpacing: '0.04em' }}>
            {tournament.title}
          </h2>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-col gap-1 text-[12px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <div className="flex items-center gap-2">
              <Calendar size={12} style={{ color: '#c8a38e' }} />
              {dateStr}
            </div>
            <div className="flex items-center gap-2">
              <Clock size={12} style={{ color: '#c8a38e' }} />
              {tournament.startTime}
            </div>
          </div>
          <div className="flex items-start gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <MapPin size={11} className="shrink-0 mt-0.5" style={{ color: '#c8a38e' }} />
            <span className="whitespace-normal break-words text-wrap">
              {CLUB_ADDRESS_CITY}
              <br />
              {CLUB_ADDRESS_STREET}
            </span>
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
      {/* Thin ring wreath — identical style to lobby finalists top-3 */}
      <div className="relative">
        <div
          className="absolute rounded-full animate-pulse pointer-events-none"
          style={{
            inset: '-3px',
            border: `2px solid ${player.glowColor}`,
            boxShadow: `0 0 8px ${player.glowColor}`,
          }}
        />
        <div
          className="relative w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-700 z-10"
          style={isFirst
            ? { background: 'linear-gradient(135deg, #8C4C27, #F2D8A7)', color: '#0A0908' }
            : { background: '#2A211D', color: '#A39B98' }}
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

function RatingSection({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onNavigate}
              className="flex items-center justify-start gap-2.5 active:opacity-70 transition-opacity">
        <span className="text-xl font-800 uppercase tracking-[0.15em] text-white">Рейтинг</span>
        <ChevronRight size={19} style={{ color: '#D99962' }} strokeWidth={2.5} />
      </button>

      <div className="flex items-end justify-center gap-3 px-2">
        {PODIUM.map((p) => <PodiumPlayer key={p.rank} player={p} />)}
      </div>

      {/* Current user — warm gradient + gold border */}
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background:
            'linear-gradient(to right, #231A16, rgba(217,153,98,0.4) 40%, rgba(217,153,98,0.8) 100%)',
          border: '1px solid #D99962',
        }}
      >
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
          <p className="text-[13px] font-700 truncate text-white">{CURRENT_USER_RATING.nickname}</p>
        </div>
        <p className="text-[13px] font-bold tracking-wide shrink-0 text-black">
          {CURRENT_USER_RATING.points.toLocaleString('ru-RU')}
        </p>
      </div>
    </div>
  );
}

// ─── Info grid ────────────────────────────────────────────────────────────────
const CLUB_ADDRESS_SHORT = 'Проспект Ленина, 2';
const CLUB_MAP_URL =
  'https://yandex.ru/maps/191/bryansk/house/prospekt_lenina_2/Z00YdQJlSkIBQFtpfX5ydH1kYg==/?ll=34.355364%2C53.235208&source=serp_navig&z=19.2';

const TILE_CLASS = 'text-left rounded-2xl p-4 active:brightness-110 transition-all';
const TILE_STYLE = {
  background: 'linear-gradient(to right, #231A16, #463129)',
  border: '1px solid rgba(255,255,255,0.06)',
} as const;

function TileIcon({ icon: Icon }: { icon: typeof MapPin }) {
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: 'rgba(140,76,39,0.2)' }}
    >
      <Icon size={17} style={{ color: '#D99962' }} />
    </div>
  );
}

function InfoGrid({
  onAboutClub,
  onQa,
  onSupport,
}: {
  onAboutClub: () => void;
  onQa: () => void;
  onSupport: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button type="button" onClick={onSupport} className={TILE_CLASS} style={TILE_STYLE}>
        <div className="flex items-center gap-3">
          <TileIcon icon={Phone} />
          <p className="text-xs font-700 text-white leading-tight">Поддержка</p>
        </div>
      </button>

      <button type="button" onClick={onAboutClub} className={TILE_CLASS} style={TILE_STYLE}>
        <div className="flex items-center gap-3">
          <TileIcon icon={Info} />
          <p className="text-sm font-700 text-white leading-tight">О клубе</p>
        </div>
      </button>

      <a
        href={CLUB_MAP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={TILE_CLASS}
        style={TILE_STYLE}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-3">
            <TileIcon icon={MapPin} />
            <div className="flex flex-col gap-0.5 pt-0.5 min-w-0">
              <p className="text-sm font-700 text-white leading-tight">Адрес</p>
              <p className="text-[11px] font-500 leading-snug" style={{ color: '#8c8c88' }}>
                {CLUB_ADDRESS_SHORT}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1" style={{ color: '#D99962' }}>
            <ExternalLink size={10} />
            <span className="text-[11px] font-600">Открыть в картах</span>
          </div>
        </div>
      </a>

      <button type="button" onClick={onQa} className={TILE_CLASS} style={TILE_STYLE}>
        <div className="flex items-center gap-3">
          <TileIcon icon={MessageCircle} />
          <p className="text-sm font-700 text-white leading-tight">Q&A</p>
        </div>
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function HomePage() {
  const navigate = useNavigate();
  const { tournaments } = useTournaments();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isSocialsOpen, setIsSocialsOpen] = useState(false);

  const nextTournament =
    tournaments.filter((t) => !isFinished(t)).sort(compareByStart)[0] ?? tournaments[0];

  return (
    <div className="flex flex-col h-full bg-obsidian">
      <Header onOpenSocials={() => setIsSocialsOpen(true)} />
      <div className="flex-1 scrollable" style={{ paddingBottom: '0.5rem' }}>
        <div className="px-5 pt-5 space-y-6">
          {nextTournament && (
            <HeroCard
              tournament={nextTournament}
              onPress={() =>
                navigate(`/tournaments/${nextTournament.id}`, { state: { from: '/' } })
              }
            />
          )}

          <RatingSection onNavigate={() => navigate('/rating')} />
          <InfoGrid
            onAboutClub={() => navigate('/about')}
            onQa={() => navigate('/qa')}
            onSupport={() => setIsSupportOpen(true)}
          />
        </div>
      </div>

      <ModalShell
        open={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        title="Поддержка"
      >
        <p className="text-xs text-[#8c8c88] mb-4 text-center">
          Делитесь своими пожеланиями/вопросами здесь:
        </p>
        <div className="space-y-2.5">
          <SocialLinkRow
            href="mailto:showdown_br@mail.ru"
            icon={<Mail size={18} className="text-[#D99962]" />}
            label="Почта"
            subtitle="showdown_br@mail.ru"
          />
          <SocialLinkRow
            href={TELEGRAM_URL}
            icon={<Send size={18} className="text-[#D99962]" />}
            label="Telegram"
            subtitle="@showdownbryansk"
          />
          <SocialLinkRow
            href="https://vk.ru/idbananablue"
            icon={<span className="text-[11px] font-800 text-[#D99962]">VK</span>}
            label="VK (Админ)"
            subtitle="vk.ru/idbananablue"
          />
          <SocialLinkRow
            href="https://vk.ru/tri3flee"
            icon={<span className="text-[11px] font-800 text-[#D99962]">VK</span>}
            label="VK (Админ 2)"
            subtitle="vk.ru/tri3flee"
          />
        </div>
      </ModalShell>

      <ModalShell
        open={isSocialsOpen}
        onClose={() => setIsSocialsOpen(false)}
        title="Мы в..."
      >
        <div className="space-y-2.5">
          <SocialLinkRow
            href="#"
            icon={<span className="text-[11px] font-800 text-[#93C5FD]">VK</span>}
            label="ВКонтакте"
            subtitle="Скоро"
          />
          <SocialLinkRow
            href="#"
            icon={<InstagramIcon size={18} className="text-[#F472B6]" />}
            label="Instagram"
            subtitle="Скоро"
          />
          <SocialLinkRow
            href={TELEGRAM_URL}
            icon={<Send size={18} className="text-[#60A5FA]" />}
            label="Telegram"
            subtitle="@showdownbryansk"
          />
        </div>
      </ModalShell>
    </div>
  );
}
