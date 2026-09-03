import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CompactHeader } from '../../components/CompactHeader';
import { ScreenLoading } from '../../components/ScreenLoading';
import { useUser } from '../../context/UserContext';
import { periodStart, type FinancePeriod } from '../../lib/financePeriod';
import { logActionLabel, logTargetLabel } from '../../lib/auditLogStorage';
import { exportAuditLogsToCSV } from '../../lib/exportToCSV';
import { supabase, logSupabaseError } from '../../lib/supabase';
import { logFromRow, type LogRow } from '../../lib/supabaseMap';
import { formatLegalDateTime, formatTxDate, formatTxTime } from '../../lib/transactionDisplay';
import type { ActionLog } from '../../types/auditLog';

type AuditPeriod = FinancePeriod | 'all';
type LogsTab = 'general' | 'consents';

const PERIODS: { id: AuditPeriod; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'all', label: 'Все время' },
];

const TABS: { id: LogsTab; label: string }[] = [
  { id: 'general', label: 'Общие логи' },
  { id: 'consents', label: 'Согласия пользователей' },
];

function formatLogDateTime(timestamp: number): string {
  const iso = new Date(timestamp).toISOString();
  return `${formatTxDate(iso)} ${formatTxTime(iso)}`;
}

function inAuditPeriod(timestamp: number, period: AuditPeriod, now = new Date()): boolean {
  if (period === 'all') return true;
  return timestamp >= periodStart(period, now).getTime() && timestamp <= now.getTime() + 60_000;
}

function asLogRow(data: unknown): LogRow | null {
  if (!data || typeof data !== 'object' || !('id' in data) || !('action_type' in data)) return null;
  return data as LogRow;
}

export function AdminLogsScreen() {
  const { isSuperAdmin, clubUsers } = useUser();
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<LogsTab>('general');
  const [period, setPeriod] = useState<AuditPeriod>('all');

  useEffect(() => {
    if (!isSuperAdmin) { setLogs([]); setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .order('timestamp', { ascending: false });
      if (error) {
        logSupabaseError(error, 'admin logs');
        if (!cancelled) {
          setLogs([]);
          setIsLoading(false);
        }
        return;
      }
      if (cancelled) return;
      setLogs(
        (data ?? []).flatMap((item) => {
          const row = asLogRow(item);
          return row ? [logFromRow(row)] : [];
        }),
      );
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  const isSuperAdminUser = isSuperAdmin;
  const filtered = useMemo(
    () =>
      logs
        .filter((log) => inAuditPeriod(log.timestamp, period))
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp),
    [logs, period],
  );
  const consents = useMemo(() => {
    if (tab !== 'consents') return [];
    return clubUsers
      .flatMap((user) =>
        user.agreementsAcceptedAt
          ? [
              {
                email: user.email,
                nickname: user.nickname,
                agreementsAcceptedAt: user.agreementsAcceptedAt,
              },
            ]
          : [],
      )
      .sort((a, b) => b.agreementsAcceptedAt.localeCompare(a.agreementsAcceptedAt));
  }, [tab, clubUsers]);

  if (!isSuperAdminUser) return <Navigate to="/profile" replace />;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <CompactHeader
        title="Журнал действий"
        backTo="/profile"
        right={
          tab === 'general' ? (
            <button
              type="button"
              disabled={filtered.length === 0}
              onClick={() => exportAuditLogsToCSV(filtered)}
              className="h-9 px-3 rounded-lg text-[11px] font-800 uppercase tracking-wide active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(to right, #8C4C27, #D99962)',
                color: '#0A0908',
              }}
            >
              Экспорт
            </button>
          ) : null
        }
      />

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <div
          className="grid grid-cols-2 gap-1 rounded-xl p-1 mb-4"
          style={{ background: '#1E1612' }}
          role="tablist"
          aria-label="Разделы журнала"
        >
          {TABS.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className="py-2.5 rounded-lg text-[11px] font-700 leading-tight transition-colors"
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

        {tab === 'general' ? (
          <>
            <div className="grid grid-cols-4 gap-1 rounded-xl p-1 mb-4" style={{ background: '#1E1612' }}>
              {PERIODS.map(({ id, label }) => {
                const active = period === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPeriod(id)}
                    className="py-2.5 rounded-lg text-[11px] font-700 leading-tight transition-colors"
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

            {isLoading && filtered.length === 0 ? (
              <ScreenLoading label="Загрузка журнала…" />
            ) : filtered.length === 0 ? (
              <p className="text-[13px] px-1" style={{ color: '#6B6360' }}>
                Нет записей за выбранный период
              </p>
            ) : (
              filtered.map((log) => {
                const action = logActionLabel(log);
                const target = logTargetLabel(log);
                return (
                  <div
                    key={log.id}
                    className="mb-3 rounded-xl p-3 space-y-1.5"
                    style={{
                      background: '#231A16',
                      borderLeft: '3px solid #D99962',
                      border: '1px solid rgba(217,153,98,0.22)',
                      borderLeftWidth: 3,
                      borderLeftColor: '#D99962',
                    }}
                  >
                    <p className="text-[11px] font-700 uppercase tracking-wide" style={{ color: '#8c8c88' }}>
                      {formatLogDateTime(log.timestamp)}
                    </p>
                    <p className="text-[13px] leading-snug text-white">
                      <span style={{ color: '#D99962' }}>Админ: </span>
                      {log.adminName || log.adminEmail}
                    </p>
                    <p className="text-[13px] leading-snug text-white">
                      <span style={{ color: '#D99962' }}>Действие: </span>
                      {action}
                    </p>
                    {target ? (
                      <p className="text-[13px] leading-snug text-white">
                        <span style={{ color: '#D99962' }}>У кого/Где: </span>
                        {target}
                      </p>
                    ) : null}
                    {log.details ? (
                      <p className="text-[13px] leading-snug text-white">
                        <span style={{ color: '#D99962' }}>Детали: </span>
                        {log.details}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </>
        ) : consents.length === 0 ? (
          <p className="text-[13px] px-1" style={{ color: '#6B6360' }}>
            Пока нет пользователей с принятыми согласиями
          </p>
        ) : (
          <div className="space-y-2">
            {consents.map((row) => (
              <div
                key={row.email}
                className="rounded-xl p-3 text-[13px] leading-relaxed text-white"
                style={{
                  background: '#231A16',
                  border: '1px solid rgba(217,153,98,0.22)',
                  borderLeftWidth: 3,
                  borderLeftColor: '#D99962',
                }}
              >
                <p className="break-words">
                  <span className="tabular-nums" style={{ color: '#D99962' }}>
                    {formatLegalDateTime(row.agreementsAcceptedAt)}
                  </span>
                  <span style={{ color: '#6B6360' }}> | </span>
                  <span>{row.nickname}</span>
                  <span style={{ color: '#6B6360' }}> | </span>
                  <span>{row.email}</span>
                  <span style={{ color: '#6B6360' }}> | </span>
                  <span>Статус: Согласия приняты (электронная подпись)</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
