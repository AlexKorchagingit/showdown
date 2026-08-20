import { useState } from 'react';
import { Database } from 'lucide-react';
import { useTournaments } from '../../context/TournamentContext';
import { useUser } from '../../context/UserContext';
import { useAuditLog } from '../../context/AuditLogContext';
import { migrateClubDataToSupabase } from '../../lib/migrateToSupabase';

/** One-shot admin control: copy mocks + localStorage into Supabase. */
export function MigrateToDatabaseButton() {
  const { email } = useUser();
  const { tournaments } = useTournaments();
  const { logAction } = useAuditLog();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    if (busy) return;
    if (
      !window.confirm(
        'Записать текущих пользователей, турниры и участников в Supabase? Повторный запуск обновит те же строки (upsert), localStorage не очищается.',
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);
    setFailed(false);
    const report = await migrateClubDataToSupabase({ tournaments, currentEmail: email });
    setBusy(false);

    if (report.error) {
      setFailed(true);
      setMessage(report.error);
      return;
    }

    setFailed(false);
    setMessage(
      `Готово: пользователей ${report.users}, турниров ${report.tournaments}, участников ${report.participants}.`,
    );
    logAction({
      actionType: 'Мигрировал данные в БД',
      details: `users ${report.users}, tournaments ${report.tournaments}, participants ${report.participants}`,
    });
  };

  return (
    <div
      className="rounded-2xl p-4 mb-4 space-y-3"
      style={{ background: '#231A16', border: '1px solid rgba(217,153,98,0.35)' }}
    >
      <p className="text-[11px] font-800 uppercase tracking-[0.16em]" style={{ color: '#F2D8A7' }}>
        Supabase
      </p>
      <p className="text-[13px] font-500 leading-relaxed" style={{ color: '#A39B98' }}>
        Перенести моки и данные из localStorage в таблицы users, tournaments и participants.
        Живые экраны уже читают Supabase; кнопка остаётся для повторного upsert.
      </p>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-[14px] font-800 uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'linear-gradient(to right, #8C4C27, #D99962)',
          color: '#0A0908',
        }}
      >
        <Database size={18} strokeWidth={2.3} />
        {busy ? 'Миграция…' : 'Мигрировать данные в БД'}
      </button>
      {message ? (
        <p className="text-[12px] font-600 leading-relaxed" style={{ color: failed ? '#f87171' : '#86efac' }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
