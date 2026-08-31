import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, ChevronDown, ChevronRight, Settings, ShoppingCart } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { useUser } from '../context/UserContext';
import { useAuditLog } from '../context/AuditLogContext';
import { CURRENT_USER_ID, useTournaments } from '../context/TournamentContext';
import { useFinance } from '../context/FinanceContext';
import {
  characterProfileLeft,
  DEFAULT_BG_ID,
  resolveImage,
} from '../data/shopItems';
import {
  characterImageForPlayer,
} from '../lib/playerCharacter';
import { formatBirthDate, resolvePublicProfile, type PublicProfileStats } from '../lib/playerName';
import { clubRatingPlayers } from '../lib/clubRating';
import { collectPlayerGameHistory, computePlayerAdminStats, summarizePlayerGameHistory } from '../lib/playerAnalytics';
import { playerEmail } from '../lib/systemPlayers';
import { AdminPlayerStats } from '../components/admin/AdminPlayerStats';
import { GameHistorySheet } from '../components/GameHistorySheet';

const SIDE_STAT_SIZES = ['text-4xl', 'text-3xl', 'text-2xl', 'text-xl', 'text-lg'] as const;

/** Shared portrait placement so own and public profiles line up. */
const PROFILE_CAT_CLASS =
  'absolute bottom-[60px] h-[57%] w-auto object-contain object-bottom z-0 pointer-events-none';

const GOLD_TEXT = 'text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7]';

const GOLD_NUM =
  `font-black ${GOLD_TEXT} drop-shadow-[0_0_8px_rgba(217,153,98,0.8)]`;

export function ProfilePage() {
  const navigate = useNavigate();
  const { playerId } = useParams<{ playerId?: string }>();
  const location = useLocation();
  const { nickname, slogan, characterImage, backgroundImage, equippedChar } = useProfile();
  const { isAdmin, userId, clubUsers } = useUser();
  const { logAction } = useAuditLog();
  const { tournaments } = useTournaments();
  const { transactions, getDealerHours, markAllUnpaidForPlayer } = useFinance();
  const [isExpanded, setIsExpanded] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);

  const readOnly = Boolean(playerId);
  const state = (location.state ?? null) as Partial<PublicProfileStats> | null;
  const publicProfile = readOnly && playerId ? resolvePublicProfile(playerId, state) : null;

  const displayNickname = publicProfile?.nickname ?? nickname;
  const displayCharacter = readOnly && playerId
    ? characterImageForPlayer(playerId, displayNickname, equippedChar)
    : characterImage;
  const displayBackground = readOnly ? resolveImage(DEFAULT_BG_ID, 'bg') : backgroundImage;

  const viewedUser = useMemo(() => {
    const needle = (readOnly ? playerId : userId)?.trim() ?? '';
    if (!needle) return undefined;
    const lower = needle.toLowerCase();
    return clubUsers.find(
      (user) =>
        user.id === needle ||
        user.email.trim().toLowerCase() === lower ||
        user.nickname.trim().toLowerCase() === lower,
    );
  }, [readOnly, playerId, userId, clubUsers]);

  const trimmedSlogan = (readOnly ? viewedUser?.slogan ?? '' : slogan).trim();
  const viewedEmail = isAdmin ? (viewedUser?.email ?? '').trim() : '';
  const viewedBirthDate =
    readOnly && isAdmin ? (viewedUser?.birthDate ?? '').trim() : '';
  const achievementsPath = readOnly && playerId
    ? `/achievements/${encodeURIComponent(playerId)}`
    : '/achievements';

  const subjectUserId =
    viewedUser?.id ?? ((readOnly ? playerId : userId)?.trim() ?? '');

  const statsPlayerId = subjectUserId || (readOnly ? playerId : userId) || '';

  const adminStats = useMemo(() => {
    if (!isAdmin || !statsPlayerId) return null;
    return computePlayerAdminStats(
      statsPlayerId,
      displayNickname,
      tournaments,
      transactions,
      getDealerHours,
    );
  }, [isAdmin, statsPlayerId, displayNickname, tournaments, transactions, getDealerHours]);

  const showAdminStats = Boolean(adminStats);

  const gameHistory = useMemo(() => {
    const ids = readOnly ? [subjectUserId] : [subjectUserId, userId, CURRENT_USER_ID];
    return collectPlayerGameHistory(tournaments, ids, displayNickname);
  }, [tournaments, readOnly, subjectUserId, userId, displayNickname]);

  const liveStats = useMemo(() => summarizePlayerGameHistory(gameHistory), [gameHistory]);

  const ratingPlace = useMemo(() => {
    if (!subjectUserId) return null;
    const ranked = clubRatingPlayers(clubUsers, tournaments);
    const index = ranked.findIndex((player) => player.id === subjectUserId);
    return index >= 0 ? index + 1 : null;
  }, [clubUsers, tournaments, subjectUserId]);

  const sideStats = useMemo(() => {
    const rows = [
      {
        label: 'Рейтинг',
        display: ratingPlace != null ? `#${ratingPlace}` : '—',
        show: true,
      },
      { label: 'Победы', display: String(liveStats.wins), show: liveStats.wins > 0 },
      { label: 'Финалы', display: String(liveStats.finals), show: liveStats.finals > 0 },
      { label: 'Нокауты', display: String(liveStats.knockouts), show: liveStats.knockouts > 0 },
      { label: 'Игры', display: String(liveStats.games), show: true },
    ].filter((row) => row.show);

    return rows.map((stat, index) => ({
      ...stat,
      size: SIDE_STAT_SIZES[Math.min(index, SIDE_STAT_SIZES.length - 1)],
    }));
  }, [ratingPlace, liveStats]);

  const extraStats = useMemo(
    () =>
      [
        { label: 'Хедз-ап', value: liveStats.headsUp },
        { label: 'Топ 3', value: liveStats.top3 },
        { label: 'Топ 9', value: liveStats.finals },
      ].filter((stat) => stat.value > 0),
    [liveStats],
  );

  return (
    <div className="relative w-full h-full overflow-hidden">
      <img
        src={displayBackground}
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      <img
        src={displayCharacter}
        alt=""
        className={PROFILE_CAT_CLASS}
        style={{ left: characterProfileLeft(equippedChar) }}
      />

      {/* Header card */}
      <div className="relative z-10 mx-4 mt-2 px-4 pt-2 pb-1 rounded-2xl bg-[#110b09]/40 backdrop-blur-md border border-[#D99962]/20">
        {!readOnly && (
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="absolute top-3 right-3 p-0 active:opacity-60 transition-opacity"
            aria-label="Настройки"
          >
            <Settings className="w-7 h-7 text-[#F2D8A7]" strokeWidth={2} />
          </button>
        )}

        <div className={readOnly ? 'min-w-0' : 'pr-10 min-w-0'}>
          <h1 className={`text-2xl font-black leading-tight ${GOLD_TEXT}`}>{displayNickname}</h1>
          {trimmedSlogan ? (
            <p className="text-white/70 italic text-sm font-light mt-1 leading-snug text-wrap break-words whitespace-normal line-clamp-2">
              «{trimmedSlogan}»
            </p>
          ) : null}
          {viewedEmail ? (
            <p className="text-white/85 text-xs font-medium mt-1 truncate">{viewedEmail}</p>
          ) : null}
          {viewedBirthDate ? (
            <p className="text-white/55 text-xs font-medium mt-1 tracking-wide">
              Дата рождения: {formatBirthDate(viewedBirthDate)}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="w-full flex justify-center mt-0.5 active:opacity-60 transition-opacity"
          aria-expanded={isExpanded}
          aria-label="Раскрыть раздел"
        >
          <ChevronDown
            size={20}
            className={`text-white transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        <motion.div
          initial={false}
          animate={{ height: isExpanded ? 'auto' : 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="flex flex-row justify-between items-center mt-2 pt-3 border-t border-white/10 gap-3 pb-1">
            <div className="flex flex-row gap-4">
              {extraStats.map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="text-lg font-bold text-[#D99962] leading-none">{value}</span>
                  <span className="text-white/60 text-[10px] uppercase mt-1 whitespace-nowrap">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigate(achievementsPath)}
              className="shrink-0 bg-gradient-to-r from-[#8C4C27] to-[#D99962] text-white text-sm font-bold px-4 py-2 rounded-lg active:scale-95 transition-transform"
            >
              Достижения
            </button>
          </div>
        </motion.div>
      </div>

      {showAdminStats && (
        <div className="relative z-10 mx-4 mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 active:opacity-70 transition-opacity"
            style={{
              background: 'rgba(17,11,9,0.72)',
              border: '1px solid rgba(217,153,98,0.35)',
            }}
          >
            <BarChart3 size={15} strokeWidth={2.3} className="text-[#F2D8A7]" />
            <span className="text-[11px] font-800 uppercase tracking-wide text-[#F2D8A7]">
              Статистика
            </span>
          </button>
        </div>
      )}

      {/* Left stats */}
      {sideStats.length > 0 && (
        <div className="relative mt-4 w-fit">
          <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-[160px] h-[150%] bg-[#231A16]/80 blur-[30px] rounded-full z-0 pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-3 pl-4 pr-8">
            {sideStats.map(({ label, display, size }) => {
              if (label === 'Игры') {
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setGamesOpen(true)}
                    className="text-left active:opacity-80 transition-opacity"
                  >
                    <p className="text-[10px] text-white font-bold drop-shadow-md uppercase tracking-wide">
                      {label}
                    </p>
                    <p className="leading-none mt-0.5 inline-flex items-center gap-0.5">
                      <span className={`${size} ${GOLD_NUM}`}>{display}</span>
                      <ChevronRight
                        size={22}
                        strokeWidth={2.4}
                        className="text-[#D99962] drop-shadow-[0_0_8px_rgba(217,153,98,0.8)]"
                      />
                    </p>
                  </button>
                );
              }

              return (
                <div key={label}>
                  <p className="text-[10px] text-white font-bold drop-shadow-md uppercase tracking-wide">
                    {label}
                  </p>
                  <p className={`${size} ${GOLD_NUM} leading-none mt-0.5`}>{display}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {readOnly ? (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute bottom-2 left-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(28,20,16,0.78)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(217,153,98,0.28)',
          }}
          aria-label="Назад"
        >
          <ArrowLeft size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
        </button>
      ) : (
        <div className="absolute bottom-2 left-0 right-0 z-10 px-4 flex flex-col items-center">
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="w-full max-w-[200px] h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold tracking-wide text-[#0A0908] py-2 px-4 active:scale-[0.97] transition-transform"
            style={{
              background: 'linear-gradient(to right, #8C4C27, #D99962)',
              boxShadow: '0 0 18px rgba(217,153,98,0.28)',
            }}
          >
            <ShoppingCart size={16} strokeWidth={2.4} />
            МАГАЗИН
          </button>
        </div>
      )}

      {showAdminStats && statsOpen && adminStats && (
        <AdminPlayerStats
          nickname={displayNickname}
          stats={adminStats}
          onClose={() => setStatsOpen(false)}
          onClearDebts={
            statsPlayerId
              ? () => {
                  const amount = adminStats?.clubDebt ?? 0;
                  markAllUnpaidForPlayer(statsPlayerId);
                  if (amount > 0) {
                    logAction({
                      actionType: 'Погасил долг',
                      targetUserId: statsPlayerId,
                      targetUserName: displayNickname,
                      targetUserEmail: playerEmail(statsPlayerId, displayNickname),
                      details: `Сумма: ${amount.toLocaleString('ru-RU')} руб`,
                    });
                  }
                }
              : undefined
          }
        />
      )}
      {gamesOpen ? (
        <GameHistorySheet rows={gameHistory} onClose={() => setGamesOpen(false)} />
      ) : null}
    </div>
  );
}
