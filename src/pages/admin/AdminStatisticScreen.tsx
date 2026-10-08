import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CompactHeader } from '../../components/CompactHeader';
import { DetailSheet } from '../../components/admin/DetailSheet';
import { MetricsLegend } from '../../components/admin/MetricsLegend';
import { useFinance } from '../../context/FinanceContext';
import { useFullTournamentRosters, useTournaments } from '../../context/TournamentContext';
import { useUser } from '../../context/UserContext';
import { CLUB_STATISTIC_METRICS } from '../../lib/metricsCopy';
import {
  formatAddonRate,
  formatAvgRebuys,
} from '../../lib/playerAnalytics';
import {
  computeClubLeaders,
  computeClubStatistics,
  filterStatisticTournaments,
  tournamentTitles,
  type ClubLeader,
  type StatDetailList,
  type StatsPeriod,
} from '../../lib/clubStatistics';
import { clubRatingPlayers } from '../../lib/clubRating';

type LeaderScope = 'season' | 'all';

const SCOPES: { id: LeaderScope; label: string }[] = [
  { id: 'season', label: 'Сезон' },
  { id: 'all', label: 'Общий' },
];

type DetailKey =
  | 'attendance'
  | 'popular'
  | 'checks'
  | 'debt'
  | 'biggest'
  | 'rebuys'
  | 'addons'
  | 'top-attendance'
  | 'top-finalists'
  | 'top-bounty';

const DETAIL_TITLE: Record<DetailKey, string> = {
  attendance: 'Средняя посещаемость',
  popular: 'Самый популярный',
  checks: 'Средний чек',
  debt: '% должников',
  biggest: 'Самый большой чек',
  rebuys: 'Ребаи',
  addons: 'Аддоны',
  'top-attendance': 'Посещаемость игроков',
  'top-finalists': 'Финалисты',
  'top-bounty': 'Баунти-хантеры',
};

const PERIODS: { id: StatsPeriod; label: string }[] = [
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'all', label: 'Все время' },
];

function formatRub(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function StatCard({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Opens the list this number is built from. */
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[10px] font-700 uppercase tracking-[0.16em]" style={{ color: '#A39B98' }}>
          {label}
        </p>
        {onClick ? (
          <ChevronRight size={14} strokeWidth={2.4} className="shrink-0" style={{ color: '#D99962' }} />
        ) : null}
      </div>
      <p className="text-[20px] font-900 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7]">
        {value}
      </p>
      {hint ? (
        <p className="text-[11px] mt-auto pt-2" style={{ color: '#8c8c88' }}>
          {hint}
        </p>
      ) : null}
    </>
  );
  const className = 'w-full rounded-2xl p-4 min-h-[108px] flex flex-col text-left';
  const style = { background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' } as const;
  if (!onClick) {
    return (
      <div className={className} style={style}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: показать список`}
      className={`${className} active:scale-[0.99] transition-transform`}
      style={style}
    >
      {body}
    </button>
  );
}

function DetailRows({ list }: { list: StatDetailList }) {
  return (
    <>
      {list.summary ? (
        <p
          className="rounded-xl px-3 py-2.5 mb-3 text-[12px] font-700 leading-snug"
          style={{
            background: 'rgba(217,153,98,0.12)',
            border: '1px solid rgba(217,153,98,0.3)',
            color: '#F2D8A7',
          }}
        >
          {list.summary}
        </p>
      ) : null}
      {list.rows.length === 0 ? (
        <p className="text-center text-[13px] pt-10" style={{ color: '#6B6360' }}>
          {list.empty}
        </p>
      ) : (
        <div className="space-y-2">
          {list.rows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl px-3 py-3"
              style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-[11px] font-600" style={{ color: '#8c8c88' }}>
                {row.date}
              </p>
              <div className="flex items-baseline justify-between gap-3 mt-0.5">
                <p className="text-[13px] font-700 text-white truncate">{row.title}</p>
                <p className="text-[13px] font-800 shrink-0" style={{ color: '#D99962' }}>
                  {row.value}
                </p>
              </div>
              {row.note ? (
                <p className="text-[12px] font-600 mt-1 truncate" style={{ color: '#A39B98' }}>
                  {row.note}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function LeaderList({
  title,
  rows,
  suffix,
  empty,
  scope,
  onScope,
  onOpen,
}: {
  title: string;
  rows: ClubLeader[];
  suffix: string;
  empty: string;
  scope: LeaderScope;
  onScope: (scope: LeaderScope) => void;
  /** Opens the whole ranking this top-3 is cut from. */
  onOpen: () => void;
}) {
  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${title}: показать весь список`}
          className="flex min-w-0 items-center gap-1 text-left"
        >
          <h3 className="text-[11px] font-800 uppercase tracking-[0.16em]" style={{ color: '#F2D8A7' }}>
            {title}
          </h3>
          <ChevronRight size={14} strokeWidth={2.4} className="shrink-0" style={{ color: '#D99962' }} />
        </button>
        <div className="flex shrink-0 rounded-lg p-0.5" style={{ background: '#1E1612' }}>
          {SCOPES.map(({ id, label }) => {
            const active = scope === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onScope(id)}
                aria-pressed={active}
                className="px-2.5 py-1 rounded-md text-[10px] font-800 uppercase tracking-wide transition-colors"
                style={{
                  background: active ? 'linear-gradient(to right, #8C4C27, #D99962)' : 'transparent',
                  color: active ? '#0A0908' : '#6B6360',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px]" style={{ color: '#6B6360' }}>
          {empty}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div
              key={`${title}-${row.id}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(17,11,9,0.55)' }}
            >
              <span
                className="w-6 text-center text-[13px] font-900"
                style={{ color: index === 0 ? '#F2D8A7' : '#D99962' }}
              >
                {index + 1}
              </span>
              <span className="flex-1 min-w-0 text-[13px] font-700 text-white truncate">
                {row.nickname}
              </span>
              <span className="text-[13px] font-800 tabular-nums" style={{ color: '#D99962' }}>
                {row.value.toLocaleString('ru-RU')} {suffix}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Notice({
  tone,
  children,
  action,
}: {
  tone: 'info' | 'error';
  children: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 mb-3 text-[12px] font-600"
      style={{
        background: tone === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(217,153,98,0.12)',
        border: `1px solid ${tone === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(217,153,98,0.3)'}`,
        color: tone === 'error' ? '#f87171' : '#F2D8A7',
      }}
    >
      <span>{children}</span>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 underline font-800"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export function AdminStatisticScreen() {
  const navigate = useNavigate();
  const { tournaments, isLoading: tournamentsLoading } = useTournaments();
  useFullTournamentRosters();
  const { transactions, isLoading: financeLoading, loadError: financeError, refreshFinance } = useFinance();
  const { clubUsers } = useUser();
  const [period, setPeriod] = useState<StatsPeriod>('all');
  const [format, setFormat] = useState('all');
  const [attendanceScope, setAttendanceScope] = useState<LeaderScope>('season');
  const [finalistScope, setFinalistScope] = useState<LeaderScope>('season');
  const [bountyScope, setBountyScope] = useState<LeaderScope>('season');
  const [detail, setDetail] = useState<DetailKey | null>(null);

  const rostersReady = tournaments.length > 0 && tournaments.every((row) => row.rosterLoaded);
  const formats = useMemo(() => tournamentTitles(tournaments), [tournaments]);
  const filtered = useMemo(
    () => filterStatisticTournaments(tournaments, period, format),
    [tournaments, period, format],
  );
  const stats = useMemo(
    () => computeClubStatistics(filtered, transactions, clubUsers, period),
    [filtered, transactions, clubUsers, period],
  );

  const seasonMonth = new Date().getMonth();
  const seasonName = new Date().toLocaleDateString('ru-RU', { month: 'long' });
  const leaders = useMemo(() => {
    const ratings = (month?: number) =>
      new Map(clubRatingPlayers(clubUsers, tournaments, month).map((row) => [row.id, row.points]));
    return {
      season: computeClubLeaders(
        filterStatisticTournaments(tournaments, 'month', format),
        clubUsers,
        ratings(seasonMonth),
        Number.POSITIVE_INFINITY,
      ),
      all: computeClubLeaders(
        filterStatisticTournaments(tournaments, 'all', format),
        clubUsers,
        ratings(),
        Number.POSITIVE_INFINITY,
      ),
    };
  }, [tournaments, clubUsers, format, seasonMonth]);

  const topList = (
    scope: LeaderScope,
    rows: ClubLeader[],
    suffix: string,
    empty: string,
  ): StatDetailList => ({
    summary: scope === 'season' ? `Сезон — ${seasonName}` : 'Общий — за всё время',
    rows: rows.map((row, index) => ({
      id: row.id,
      date: `${index + 1} место`,
      title: row.nickname,
      value: `${row.value.toLocaleString('ru-RU')} ${suffix}`,
    })),
    empty,
  });

  const detailList = (key: DetailKey): StatDetailList => {
    switch (key) {
      case 'top-attendance':
        return topList(attendanceScope, leaders[attendanceScope].attendance, 'игр', 'Пока нет игроков в выборке');
      case 'top-finalists':
        return topList(finalistScope, leaders[finalistScope].finalists, 'финалов', 'Нет попаданий на финальный стол');
      case 'top-bounty':
        return topList(bountyScope, leaders[bountyScope].bounty, 'КО', 'Нет нокаутов в выборке');
      default:
        return stats.details[key];
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <CompactHeader title="Statistic" backTo="/profile" />

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        {tournamentsLoading || !rostersReady ? (
          <Notice tone="info">Загружаем турниры и составы — цифры могут быть неполными.</Notice>
        ) : null}
        {financeError ? (
          <Notice
            tone="error"
            action={{ label: 'Повторить', onClick: () => void refreshFinance('all') }}
          >
            Касса не загрузилась — деньги, ребаи и аддоны могут быть неполными.
          </Notice>
        ) : financeLoading ? (
          <Notice tone="info">Загружаем кассу — деньги, ребаи и аддоны появятся через секунду.</Notice>
        ) : null}

        <div className="flex rounded-xl p-1 mb-3" style={{ background: '#1E1612' }}>
          {PERIODS.map(({ id, label }) => {
            const active = period === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPeriod(id)}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-700 transition-colors"
                style={{
                  background: active ? 'linear-gradient(to right, #8C4C27, #D99962)' : 'transparent',
                  color: active ? '#0A0908' : '#6B6360',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <select
          value={format}
          onChange={(event) => setFormat(event.target.value)}
          className="w-full h-11 mb-5 rounded-xl px-3 text-[13px] font-700 text-white outline-none"
          style={{
            background: '#231A16',
            border: '1px solid rgba(217,153,98,0.35)',
          }}
        >
          <option value="all">Все форматы</option>
          {formats.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </select>

        <h2 className="text-[11px] font-800 uppercase tracking-[0.18em] mb-3" style={{ color: '#D99962' }}>
          Финансы и посещаемость
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            label="Средняя посещаемость"
            value={stats.averageAttendance ? stats.averageAttendance.toFixed(1).replace('.', ',') : '0'}
            hint="чел. на турнир"
            onClick={() => setDetail('attendance')}
          />
          <StatCard
            label="Самый популярный"
            value={stats.popularTournament}
            hint={`${stats.tournamentCount} турн. в выборке`}
            onClick={() => setDetail('popular')}
          />
          <StatCard
            label="Средний чек"
            value={formatRub(stats.averageCheck)}
            hint="оплаченные деньги, без билетов"
            onClick={() => setDetail('checks')}
          />
          <StatCard
            label="% должников"
            value={`${stats.debtorPercent.toFixed(stats.debtorPercent % 1 === 0 ? 0 : 1).replace('.', ',')}%`}
            hint="деньги unpaid / все не-void"
            onClick={() => setDetail('debt')}
          />
          <div className="col-span-2">
            <StatCard
              label="Самый большой чек"
              value={formatRub(stats.biggestCheck.amount)}
              hint={`${stats.biggestCheck.nickname} · ${stats.biggestCheck.tournament}`}
              onClick={() => setDetail('biggest')}
            />
          </div>
          <StatCard
            label="Ср. ребаев за турнир"
            value={formatAvgRebuys(stats.avgRebuys, stats.seatedCount)}
            hint={`${stats.rebuyCount} ребаев · ${stats.seatedCount} входов`}
            onClick={() => setDetail('rebuys')}
          />
          <StatCard
            label="Частота аддонов"
            value={formatAddonRate(stats.addonRate)}
            hint={
              stats.addonEligibleSeats > 0 && stats.addonEligibleSeats !== stats.seatedCount
                ? `${stats.addonCount} аддонов · ${stats.addonEligibleSeats} с аддоном`
                : `${stats.addonCount} аддонов · ${stats.seatedCount} входов`
            }
            onClick={() => setDetail('addons')}
          />
        </div>

        <div
          className="rounded-2xl px-2 py-4 mb-6"
          style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
        >
          <button
            type="button"
            onClick={() => setDetail('attendance')}
            aria-label="Посещаемость: показать список турниров"
            className="mb-2 flex w-full items-center gap-1 px-3 text-left"
          >
            <span className="text-[11px] font-700 uppercase tracking-[0.16em]" style={{ color: '#8c8c88' }}>
              Посещаемость
            </span>
            <ChevronRight size={14} strokeWidth={2.4} className="shrink-0" style={{ color: '#D99962' }} />
          </button>
          <div className={period === 'month' ? 'h-60' : 'h-52'}>
            {stats.attendanceChart.length === 0 ? (
              <p className="text-center text-[13px] pt-16" style={{ color: '#6B6360' }}>
                Нет турниров за период
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  key={`${period}-${format}-${stats.attendanceChart.length}`}
                  data={stats.attendanceChart}
                  barCategoryGap={period === 'month' ? 2 : 8}
                  margin={{ top: 8, right: 4, left: 0, bottom: period === 'month' ? 2 : 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    type="category"
                    dataKey="id"
                    allowDuplicatedCategory={false}
                    interval={0}
                    tickFormatter={(id: string) =>
                      stats.attendanceChart.find((row) => row.id === id)?.tick ?? id
                    }
                    tick={{
                      fill: '#8c8c88',
                      fontSize: period === 'month' ? 8 : 10,
                    }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                    angle={period === 'all' && stats.attendanceChart.length > 8 ? -28 : 0}
                    textAnchor={period === 'all' && stats.attendanceChart.length > 8 ? 'end' : 'middle'}
                    height={period === 'all' && stats.attendanceChart.length > 8 ? 48 : 28}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#8c8c88', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(217,153,98,0.08)' }}
                    contentStyle={{
                      background: '#231A16',
                      border: '1px solid rgba(217,153,98,0.35)',
                      borderRadius: 12,
                      color: '#F2D8A7',
                      fontSize: 12,
                    }}
                    labelFormatter={(_label, payload) => {
                      const row = payload?.[0]?.payload as
                        | { label?: string; title?: string }
                        | undefined;
                      if (!row?.label) return '';
                      return row.title ? `${row.label} · ${row.title}` : row.label;
                    }}
                    formatter={(value) => [`${Number(value ?? 0)} чел.`, 'Игроки']}
                  />
                  <Bar
                    dataKey="players"
                    maxBarSize={period === 'month' ? 10 : 36}
                    minPointSize={(_value, index) =>
                      period === 'all' || stats.attendanceChart[index]?.future ? 0 : 3}
                    radius={period === 'month' ? [2, 2, 0, 0] : [6, 6, 0, 0]}
                  >
                    {stats.attendanceChart.map((row) => (
                      <Cell
                        key={row.id}
                        fill={
                          row.future
                            ? 'transparent'
                            : row.players > 0
                              ? '#D99962'
                              : 'rgba(217,153,98,0.18)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {stats.skippedSeats > 0 ? (
            <p className="px-3 pt-3 text-[11px] leading-snug" style={{ color: '#8c8c88' }}>
              Не вошли в расчёт: {stats.skippedSeats.toLocaleString('ru-RU')} мест без аккаунта
              {stats.unboundNicks > 0 ? ` (${stats.unboundNicks.toLocaleString('ru-RU')} ников)` : ''}.{' '}
              {stats.unboundNicks > 0 ? (
                <button
                  type="button"
                  onClick={() => navigate('/admin/users?view=guests')}
                  className="underline font-700"
                  style={{ color: '#D99962' }}
                >
                  Привязать ники
                </button>
              ) : null}
            </p>
          ) : null}
        </div>

        <h2 className="text-[11px] font-800 uppercase tracking-[0.18em] mb-1" style={{ color: '#D99962' }}>
          Топы игроков
        </h2>
        <p className="text-[11px] mb-3" style={{ color: '#6B6360' }}>
          Сезон — {seasonName}, общий — за всё время. Период сверху на топы не влияет.
        </p>
        <div className="space-y-3">
          <LeaderList
            title="Топ-3 по посещаемости"
            rows={leaders[attendanceScope].attendance.slice(0, 3)}
            onOpen={() => setDetail('top-attendance')}
            suffix="игр"
            empty="Пока нет игроков в выборке"
            scope={attendanceScope}
            onScope={setAttendanceScope}
          />
          <LeaderList
            title="Топ-3 финалистов"
            rows={leaders[finalistScope].finalists.slice(0, 3)}
            onOpen={() => setDetail('top-finalists')}
            suffix="финалов"
            empty="Нет попаданий на финальный стол"
            scope={finalistScope}
            onScope={setFinalistScope}
          />
          <LeaderList
            title="Топ-3 баунти-хантеров"
            rows={leaders[bountyScope].bounty.slice(0, 3)}
            onOpen={() => setDetail('top-bounty')}
            suffix="КО"
            empty="Нет нокаутов в выборке"
            scope={bountyScope}
            onScope={setBountyScope}
          />
          <MetricsLegend title="Как считаются цифры" notes={CLUB_STATISTIC_METRICS} />
        </div>
      </div>

      {detail ? (
        <DetailSheet title={DETAIL_TITLE[detail]} onClose={() => setDetail(null)}>
          <DetailRows list={detailList(detail)} />
        </DetailSheet>
      ) : null}
    </div>
  );
}
