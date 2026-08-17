import { useState, type ReactNode } from 'react';
import { CalendarDays, Clock, Landmark, Medal, Percent, Trophy, Wallet, X } from 'lucide-react';
import type { PlayerAdminStats, PlayerLedgerRow, PlayerTournamentRow } from '../../lib/playerAnalytics';

function formatMoney(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  const label = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', ',');
  return `${label} ч`;
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent = '#D99962',
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  onClick?: () => void;
}) {
  const className =
    'rounded-2xl p-4 min-h-[120px] flex flex-col text-left w-full';
  const style = {
    background: '#2A211D',
    border: '1px solid rgba(217,153,98,0.22)',
  } as const;
  const inner = (
    <>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(217,153,98,0.14)', color: accent }}
        >
          {icon}
        </div>
        <p className="text-[10px] font-700 uppercase tracking-[0.16em]" style={{ color: '#A39B98' }}>
          {label}
        </p>
      </div>
      <p className="text-[20px] font-900 leading-tight break-words text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7]">
        {value}
      </p>
      {hint ? (
        <p className="text-[11px] mt-auto pt-2" style={{ color: '#8c8c88' }}>
          {hint}
        </p>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} active:scale-[0.99] transition-transform`}
        style={style}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={className} style={style}>
      {inner}
    </div>
  );
}

function DetailSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-[90] flex flex-col bg-[#110b09]">
      <div className="flex-shrink-0 flex items-center gap-3 px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(28,20,16,0.78)',
            border: '1px solid rgba(217,153,98,0.28)',
          }}
          aria-label="Назад"
        >
          <X size={18} strokeWidth={2.2} style={{ color: '#D99962' }} />
        </button>
        <h3 className="text-[15px] font-800 text-white truncate">{title}</h3>
      </div>
      <div
        className="flex-1 scrollable px-4 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        {children}
      </div>
    </div>
  );
}

function LedgerList({ rows, empty }: { rows: PlayerLedgerRow[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <p className="text-center text-[13px] pt-10" style={{ color: '#6B6360' }}>
        {empty}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.id}
          className="rounded-xl px-3 py-3"
          style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-[11px] font-600" style={{ color: '#8c8c88' }}>
            {row.date}
          </p>
          <div className="flex items-baseline justify-between gap-3 mt-0.5">
            <p className="text-[13px] font-700 text-white truncate">{row.tournament}</p>
            <p className="text-[13px] font-800 shrink-0" style={{ color: '#D99962' }}>
              {row.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryList({ rows }: { rows: PlayerTournamentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-center text-[13px] pt-10" style={{ color: '#6B6360' }}>
        Нет сыгранных турниров
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.id}
          className="rounded-xl px-3 py-3"
          style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-[14px] font-800 text-white">{row.title}</p>
          <p className="text-[12px] font-600 mt-1" style={{ color: '#A39B98' }}>
            Место {row.place ?? '—'} из {row.field}{' '}
            <span style={{ color: '#D99962' }}>(В призах: {row.itm} чел)</span>
          </p>
        </div>
      ))}
    </div>
  );
}

type Drill =
  | 'ltv'
  | 'debt'
  | 'dealer'
  | 'visits'
  | 'history'
  | null;

export function AdminPlayerStats({
  nickname,
  stats,
  onClose,
}: {
  nickname: string;
  stats: PlayerAdminStats;
  onClose: () => void;
}) {
  const [drill, setDrill] = useState<Drill>(null);
  const favorite =
    stats.favoriteTournamentCount > 0
      ? `${stats.favoriteTournament} (${stats.favoriteTournamentCount} раз)`
      : '—';

  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-[#110b09]">
      <div className="flex-shrink-0 flex items-center gap-3 px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(28,20,16,0.78)',
            border: '1px solid rgba(217,153,98,0.28)',
          }}
          aria-label="Закрыть статистику"
        >
          <X size={18} strokeWidth={2.2} style={{ color: '#D99962' }} />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-700 uppercase tracking-[0.18em]" style={{ color: '#A39B98' }}>
            Админ-дашборд
          </p>
          <h2 className="text-[16px] font-800 text-white truncate">{nickname}</h2>
        </div>
      </div>

      <div
        className="flex-1 scrollable px-4 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Wallet size={16} strokeWidth={2.3} />}
            label="LTV"
            value={formatMoney(stats.ltv)}
            hint="Всего занесено (paid)"
            onClick={() => setDrill('ltv')}
          />
          <StatCard
            icon={<Landmark size={16} strokeWidth={2.3} />}
            label="Долг клуба"
            value={formatMoney(stats.clubDebt)}
            hint="Сумма unpaid"
            accent={stats.clubDebt > 0 ? '#f87171' : '#D99962'}
            onClick={() => setDrill('debt')}
          />
          <StatCard
            icon={<Percent size={16} strokeWidth={2.3} />}
            label="ROI / винрейт"
            value={`${stats.winrate.toFixed(stats.winrate % 1 === 0 ? 0 : 1).replace('.', ',')}%`}
            hint={`ITM ${stats.itmCount} из ${stats.tournamentsPlayed}`}
            onClick={() => setDrill('history')}
          />
          <StatCard
            icon={<Clock size={16} strokeWidth={2.3} />}
            label="Всего дилерил"
            value={formatHours(stats.dealerHours)}
            hint="Часы за столом"
            onClick={() => setDrill('dealer')}
          />
          <StatCard
            icon={<CalendarDays size={16} strokeWidth={2.3} />}
            label="Всего визитов"
            value={String(stats.tournamentsPlayed)}
            hint="Сыграно турниров"
            onClick={() => setDrill('visits')}
          />
          <StatCard
            icon={<Medal size={16} strokeWidth={2.3} />}
            label="Сумма призовых"
            value={stats.prizePoints.toLocaleString('ru-RU')}
            hint="Выиграно очков"
          />
          <div className="col-span-2">
            <StatCard
              icon={<Trophy size={16} strokeWidth={2.3} />}
              label="Любимый турнир"
              value={favorite}
              hint="Где чаще всего играл"
            />
          </div>
        </div>
      </div>

      {drill === 'ltv' && (
        <DetailSheet title="LTV" onClose={() => setDrill(null)}>
          <LedgerList rows={stats.ltvRows} empty="Нет оплаченных транзакций" />
        </DetailSheet>
      )}
      {drill === 'debt' && (
        <DetailSheet title="Долг клуба" onClose={() => setDrill(null)}>
          <LedgerList rows={stats.debtRows} empty="Долгов нет" />
        </DetailSheet>
      )}
      {drill === 'dealer' && (
        <DetailSheet title="Дилерские часы" onClose={() => setDrill(null)}>
          <LedgerList rows={stats.dealerRows} empty="Нет дилерских часов" />
        </DetailSheet>
      )}
      {drill === 'visits' && (
        <DetailSheet title="Визиты" onClose={() => setDrill(null)}>
          <LedgerList rows={stats.visitRows} empty="Нет сыгранных турниров" />
        </DetailSheet>
      )}
      {drill === 'history' && (
        <DetailSheet title="История турниров" onClose={() => setDrill(null)}>
          <HistoryList rows={stats.tournamentHistory} />
        </DetailSheet>
      )}
    </div>
  );
}
