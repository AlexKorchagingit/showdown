import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Link2, Search, X } from 'lucide-react';
import { CompactHeader } from '../../components/CompactHeader';
import { PlayerAvatar } from '../../components/PlayerAvatar';
import { ScreenLoading } from '../../components/ScreenLoading';
import { useFinance } from '../../context/FinanceContext';
import { useFullTournamentRosters, useTournaments } from '../../context/TournamentContext';
import { useUser } from '../../context/UserContext';
import { bindGuestNick } from '../../lib/guestNickBinding';
import { collectGuestNicks, guestBindConflicts, type GuestNick } from '../../lib/guestNicks';
import { matchesPlayerSearch } from '../../lib/playerSearch';

function tournamentsWord(count: number): string {
  const tail = count % 100;
  const last = count % 10;
  if (tail >= 11 && tail <= 14) return 'турниров';
  if (last === 1) return 'турнир';
  if (last >= 2 && last <= 4) return 'турнира';
  return 'турниров';
}

function shortDate(isoDay: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay);
  return match ? `${match[3]}.${match[2]}.${match[1].slice(2)}` : isoDay;
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block">
      <Search
        size={14}
        strokeWidth={2.4}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: '#A39B98' }}
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full h-10 rounded-lg pl-9 pr-3 text-[13px] text-white outline-none"
        style={{ background: '#231A16', border: '1px solid rgba(217,153,98,0.35)' }}
      />
    </label>
  );
}

export function AdminGuestNicksScreen({ onBack }: { onBack: () => void }) {
  const { tournaments, isLoading, fetchTournaments, loadAllRosters } = useTournaments();
  useFullTournamentRosters();
  const { clubUsers } = useUser();
  const { refreshFinance } = useFinance();
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [binding, setBinding] = useState<GuestNick | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const rostersReady = tournaments.length > 0 && tournaments.every((row) => row.rosterLoaded);
  const nicks = useMemo(() => collectGuestNicks(tournaments), [tournaments]);
  const shown = useMemo(
    () => nicks.filter((row) => matchesPlayerSearch({ nickname: row.nickname }, query)),
    [nicks, query],
  );
  const candidates = useMemo(
    () => clubUsers.filter((user) => matchesPlayerSearch(user, userQuery)),
    [clubUsers, userQuery],
  );

  const closeSheet = () => {
    if (busy) return;
    setBinding(null);
    setUserQuery('');
  };

  const pickUser = async (user: (typeof clubUsers)[number]) => {
    if (!binding || busy) return;
    const clash = guestBindConflicts(binding, user.id, tournaments);
    if (clash.length > 0) {
      window.alert(
        `${user.nickname} уже есть в турнире: ${clash.join(', ')}. Уберите дубль в этом турнире и повторите.`,
      );
      return;
    }
    const count = binding.appearances.length;
    const ok = window.confirm(
      `Привязать ник «${binding.nickname}» к игроку ${user.nickname}?\n\n` +
        `Игрок появится в ${count} ${tournamentsWord(count)} с этим ником и в их кассе.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const result = await bindGuestNick(binding.key, user.id);
      await fetchTournaments();
      await loadAllRosters();
      await refreshFinance('all');
      setBinding(null);
      setUserQuery('');
      if (result.tournaments === 0) {
        window.alert('Этот ник уже привязан или не найден. Список обновлён.');
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось привязать ник');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <CompactHeader title="Без аккаунта" onBack={onBack} />

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <p className="text-[12px] font-500 mb-3 px-1" style={{ color: '#6B6360' }}>
          Ники, которых внесли в турниры без аккаунта. После привязки игрок появится во всех турнирах
          этого ника, а касса и статистика посчитаются на него.
        </p>

        <div className="mb-3">
          <SearchField value={query} onChange={setQuery} placeholder="Поиск по нику" />
        </div>

        {isLoading || !rostersReady ? (
          <ScreenLoading label="Загрузка турниров…" />
        ) : shown.length === 0 ? (
          <p className="text-center text-[13px] font-500 py-8" style={{ color: '#6B6360' }}>
            {nicks.length === 0 ? 'Ников без аккаунта нет' : 'Никого не нашли'}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] font-700 uppercase tracking-[0.16em] px-1" style={{ color: '#8c8c88' }}>
              Всего: {shown.length}
            </p>
            {shown.map((nick) => {
              const open = openKey === nick.key;
              const count = nick.appearances.length;
              return (
                <div
                  key={nick.key}
                  className="rounded-2xl px-4 py-3.5"
                  style={{ background: '#231A16', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center gap-3">
                    <PlayerAvatar playerId={nick.key} nickname={nick.nickname} size="sm" />
                    <button
                      type="button"
                      onClick={() => setOpenKey(open ? null : nick.key)}
                      className="min-w-0 flex-1 text-left"
                      aria-expanded={open}
                    >
                      <p className="text-white font-700 text-[15px] truncate">{nick.nickname}</p>
                      <p className="text-[12px] font-500 truncate" style={{ color: '#8c8c88' }}>
                        {count} {tournamentsWord(count)} · последний {shortDate(nick.lastDate)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenKey(open ? null : nick.key)}
                      aria-label={open ? 'Скрыть турниры' : 'Показать турниры'}
                      className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      {open ? (
                        <ChevronUp size={15} style={{ color: '#D99962' }} />
                      ) : (
                        <ChevronDown size={15} style={{ color: '#D99962' }} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBinding(nick);
                        setUserQuery('');
                      }}
                      className="shrink-0 h-8 px-2.5 rounded-lg flex items-center gap-1 text-[11px] font-800 active:scale-[0.97]"
                      style={{
                        background: 'rgba(217,153,98,0.14)',
                        border: '1px solid rgba(217,153,98,0.4)',
                        color: '#F2D8A7',
                      }}
                      aria-label={`Привязать ${nick.nickname} к игроку`}
                    >
                      <Link2 size={13} strokeWidth={2.4} />
                      Привязать
                    </button>
                  </div>

                  {open ? (
                    <div className="mt-3 space-y-1.5">
                      {nick.appearances.map((row) => (
                        <div
                          key={row.tournamentId}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                          style={{ background: 'rgba(17,11,9,0.55)' }}
                        >
                          <span className="min-w-0 truncate text-[12px] font-600 text-white">
                            {row.title}
                          </span>
                          <span className="shrink-0 text-[11px] font-600" style={{ color: '#8c8c88' }}>
                            {shortDate(row.startDate)}
                            {row.place ? ` · ${row.place} место` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {binding ? (
        <div className="absolute inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/65"
            aria-label="Закрыть"
            onClick={closeSheet}
          />
          <div
            className="relative w-full max-h-[80%] flex flex-col rounded-t-3xl px-4 pt-4"
            style={{
              background: '#1A1411',
              border: '1px solid rgba(217,153,98,0.28)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
            }}
          >
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-3" />
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-800 uppercase tracking-wide text-white">
                  Привязать к игроку
                </h2>
                <p className="text-[12px] font-500 truncate" style={{ color: '#D99962' }}>
                  Ник «{binding.nickname}» · {binding.appearances.length}{' '}
                  {tournamentsWord(binding.appearances.length)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSheet}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)' }}
                aria-label="Закрыть"
              >
                <X size={16} style={{ color: '#A39B98' }} />
              </button>
            </div>

            <div className="mb-3">
              <SearchField value={userQuery} onChange={setUserQuery} placeholder="Поиск игрока по нику" />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
              {candidates.length === 0 ? (
                <p className="text-center text-[13px] font-500 py-6" style={{ color: '#6B6360' }}>
                  Никого не нашли
                </p>
              ) : (
                candidates.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void pickUser(user)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left active:scale-[0.99] disabled:opacity-60"
                    style={{ background: '#231A16', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <PlayerAvatar
                      playerId={user.id}
                      nickname={user.nickname}
                      src={user.equippedAvatar}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-white font-700 text-[14px] truncate">
                        {user.nickname}
                      </span>
                      <span className="block text-[11px] font-500 truncate" style={{ color: '#8c8c88' }}>
                        {user.email}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
            {busy ? (
              <p className="pt-3 text-center text-[12px] font-600" style={{ color: '#D99962' }}>
                Привязываем…
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
