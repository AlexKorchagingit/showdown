import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CompactHeader } from '../../components/CompactHeader';
import { useFinance } from '../../context/FinanceContext';
import { useTournaments } from '../../context/TournamentContext';
import { useUser } from '../../context/UserContext';
import {
  formatAddonRate,
  formatAvgRebuys,
} from '../../lib/playerAnalytics';
import {
  computeClubStatistics,
  filterStatisticTournaments,
  tournamentTitles,
  type StatsPeriod,
} from '../../lib/clubStatistics';

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
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 min-h-[108px] flex flex-col"
      style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
    >
      <p className="text-[10px] font-700 uppercase tracking-[0.16em] mb-2" style={{ color: '#A39B98' }}>
        {label}
      </p>
      <p className="text-[20px] font-900 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7]">
        {value}
      </p>
      {hint ? (
        <p className="text-[11px] mt-auto pt-2" style={{ color: '#8c8c88' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function LeaderList({
  title,
  rows,
  suffix,
  empty,
}: {
  title: string;
  rows: { nickname: string; value: number }[];
  suffix: string;
  empty: string;
}) {
  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <h3 className="text-[11px] font-800 uppercase tracking-[0.16em] mb-3" style={{ color: '#F2D8A7' }}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-[13px]" style={{ color: '#6B6360' }}>
          {empty}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div
              key={`${title}-${row.nickname}`}
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

export function AdminStatisticScreen() {
  const { tournaments } = useTournaments();
  const { transactions } = useFinance();
  const { clubUsers } = useUser();
  const [period, setPeriod] = useState<StatsPeriod>('all');
  const [format, setFormat] = useState('all');

  const formats = useMemo(() => tournamentTitles(tournaments), [tournaments]);
  const filtered = useMemo(
    () => filterStatisticTournaments(tournaments, period, format),
    [tournaments, period, format],
  );
  const stats = useMemo(
    () => computeClubStatistics(filtered, transactions, clubUsers, period),
    [filtered, transactions, clubUsers, period],
  );

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <CompactHeader title="Statistic" backTo="/profile" />

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
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
          />
          <StatCard
            label="Самый популярный"
            value={stats.popularTournament}
            hint={`${stats.tournamentCount} турн. в выборке`}
          />
          <StatCard
            label="Средний чек"
            value={formatRub(stats.averageCheck)}
            hint="выручка / входы"
          />
          <StatCard
            label="% должников"
            value={`${stats.debtorPercent.toFixed(stats.debtorPercent % 1 === 0 ? 0 : 1).replace('.', ',')}%`}
            hint="unpaid / все транзакции"
          />
          <div className="col-span-2">
            <StatCard
              label="Самый большой чек"
              value={formatRub(stats.biggestCheck.amount)}
              hint={`${stats.biggestCheck.nickname} · ${stats.biggestCheck.tournament}`}
            />
          </div>
          <StatCard
            label="Ср. ребаев за турнир"
            value={formatAvgRebuys(stats.avgRebuys, stats.seatedCount)}
            hint={`${stats.rebuyCount} ребаев · ${stats.seatedCount} входов`}
          />
          <StatCard
            label="Частота аддонов"
            value={formatAddonRate(stats.addonRate)}
            hint={
              stats.addonEligibleSeats > 0 && stats.addonEligibleSeats !== stats.seatedCount
                ? `${stats.addonCount} аддонов · ${stats.addonEligibleSeats} с аддоном`
                : `${stats.addonCount} аддонов · ${stats.seatedCount} входов`
            }
          />
        </div>

        <div
          className="rounded-2xl px-2 py-4 mb-6"
          style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
        >
          <p className="px-3 text-[11px] font-700 uppercase tracking-[0.16em] mb-2" style={{ color: '#8c8c88' }}>
            Посещаемость
          </p>
          <div className="h-52">
            {stats.attendanceChart.length === 0 ? (
              <p className="text-center text-[13px] pt-16" style={{ color: '#6B6360' }}>
                Нет турниров за период
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  key={`${period}-${format}`}
                  data={stats.attendanceChart}
                  margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="id"
                    tickFormatter={(id: string) =>
                      stats.attendanceChart.find((row) => row.id === id)?.label ?? id
                    }
                    tick={{ fill: '#8c8c88', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                    interval={
                      stats.attendanceChart.length > 12
                        ? Math.ceil(stats.attendanceChart.length / 8) - 1
                        : 0
                    }
                    angle={stats.attendanceChart.length > 8 ? -28 : 0}
                    textAnchor={stats.attendanceChart.length > 8 ? 'end' : 'middle'}
                    height={stats.attendanceChart.length > 8 ? 48 : 28}
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
                  <Bar dataKey="players" fill="#D99962" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <h2 className="text-[11px] font-800 uppercase tracking-[0.18em] mb-3" style={{ color: '#D99962' }}>
          Топы игроков
        </h2>
        <div className="space-y-3">
          <LeaderList
            title="Топ-3 по посещаемости"
            rows={stats.topAttendance}
            suffix="игр"
            empty="Пока нет игроков в выборке"
          />
          <LeaderList
            title="Топ-3 финалистов"
            rows={stats.topFinalists}
            suffix="финалов"
            empty="Нет попаданий в топ-9"
          />
          <LeaderList
            title="Топ-3 баунти-хантеров"
            rows={stats.topBounty}
            suffix="КО"
            empty="Нет нокаутов в выборке"
          />
        </div>
      </div>
    </div>
  );
}
