import { BarChart3, Clock, Landmark, Percent, Trophy, Wallet, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PlayerAdminStats } from '../../lib/playerAnalytics';

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
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 min-h-[132px] flex flex-col"
      style={{
        background: '#2A211D',
        border: '1px solid rgba(217,153,98,0.22)',
      }}
    >
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
      <p
        className="text-[20px] font-900 leading-tight break-words text-transparent bg-clip-text bg-gradient-to-r from-[#D99962] to-[#F2D8A7]"
      >
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

export function PlayerAdminStatsModal({
  nickname,
  stats,
  onClose,
}: {
  nickname: string;
  stats: PlayerAdminStats;
  onClose: () => void;
}) {
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
          />
          <StatCard
            icon={<Landmark size={16} strokeWidth={2.3} />}
            label="Долг клуба"
            value={formatMoney(stats.clubDebt)}
            hint="Сумма unpaid"
            accent={stats.clubDebt > 0 ? '#f87171' : '#D99962'}
          />
          <StatCard
            icon={<Percent size={16} strokeWidth={2.3} />}
            label="ROI / винрейт"
            value={`${stats.winrate.toFixed(stats.winrate % 1 === 0 ? 0 : 1).replace('.', ',')}%`}
            hint={`ITM ${stats.itmCount} из ${stats.tournamentsPlayed}`}
          />
          <StatCard
            icon={<Clock size={16} strokeWidth={2.3} />}
            label="Всего дилерил"
            value={formatHours(stats.dealerHours)}
            hint="Часы за столом"
          />
          <div className="col-span-2">
            <StatCard
              icon={<Trophy size={16} strokeWidth={2.3} />}
              label="Любимый турнир"
              value={stats.favoriteTournament}
              hint="Где чаще всего играл"
            />
          </div>
        </div>

        <div
          className="mt-4 rounded-2xl px-4 py-3 flex items-center gap-2"
          style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <BarChart3 size={16} style={{ color: '#D99962' }} />
          <p className="text-[11px] leading-snug" style={{ color: '#8c8c88' }}>
            Считается на лету по кассе и составам турниров.
          </p>
        </div>
      </div>
    </div>
  );
}
