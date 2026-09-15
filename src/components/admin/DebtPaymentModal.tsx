import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { TRANSACTION_TYPE_LABEL, type Transaction } from '../../types/finance';
import { formatTxDateTime } from '../../lib/transactionDisplay';

interface Props {
  open: boolean;
  nickname: string;
  /** Unpaid charges of one player in one tournament. */
  transactions: Transaction[];
  busy: boolean;
  onClose: () => void;
  onPay: (transactionIds: string[]) => void;
}

function formatRub(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

/** «Оплатить 1 позицию» / «2 позиции» / «5 позиций». */
function positionsLabel(count: number): string {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return `${count} позиций`;
  const last = count % 10;
  if (last === 1) return `${count} позицию`;
  if (last >= 2 && last <= 4) return `${count} позиции`;
  return `${count} позиций`;
}

export function DebtPaymentModal({
  open,
  nickname,
  transactions,
  busy,
  onClose,
  onPay,
}: Props) {
  // Everything is selected by default, so only the unticked ids are tracked:
  // a background finance refresh then cannot wipe the admin's choice.
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) setExcludedIds([]);
  }, [open]);

  const excluded = useMemo(() => new Set(excludedIds), [excludedIds]);
  const chosen = transactions.filter((tx) => !excluded.has(tx.id));
  const total = chosen.reduce((sum, tx) => sum + tx.amount, 0);
  const allChosen = chosen.length === transactions.length && transactions.length > 0;

  const toggle = (id: string) => {
    setExcludedIds((prev) =>
      prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id],
    );
  };

  const payLabel = allChosen
    ? `Оплатить все · ${formatRub(total)}`
    : `Оплатить ${positionsLabel(chosen.length)} · ${formatRub(total)}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center px-5 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => {
            if (!busy) onClose();
          }}
        >
          <motion.div
            className="w-full max-w-[360px] rounded-2xl p-5 bg-[#231A16]/95 border border-[#D99962]/30"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="debt-payment-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="debt-payment-title"
              className="text-[15px] font-900 text-white uppercase tracking-wide"
            >
              Оплата долга
            </h2>
            <p className="text-[13px] mt-1 truncate" style={{ color: '#D99962' }}>
              {nickname}
            </p>

            {transactions.length === 0 ? (
              <p className="text-[13px] py-8 text-center" style={{ color: '#8c8c88' }}>
                Неоплаченных позиций нет
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between mt-4 mb-2">
                  <span
                    className="text-[11px] font-700 uppercase tracking-[0.16em]"
                    style={{ color: '#8c8c88' }}
                  >
                    Позиции · {transactions.length}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setExcludedIds(allChosen ? transactions.map((tx) => tx.id) : [])
                    }
                    className="text-[12px] font-700 text-[#D99962] disabled:opacity-45"
                  >
                    {allChosen ? 'Снять все' : 'Выбрать все'}
                  </button>
                </div>

                <div className="space-y-2 max-h-[42vh] overflow-y-auto -mx-1 px-1">
                  {transactions.map((tx) => {
                    const checked = !excluded.has(tx.id);
                    return (
                      <button
                        key={tx.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        disabled={busy}
                        onClick={() => toggle(tx.id)}
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left border transition-colors disabled:opacity-60 ${
                          checked
                            ? 'bg-green-500/10 border-green-500/45'
                            : 'bg-white/[0.04] border-white/10'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center border ${
                            checked
                              ? 'bg-green-500/25 border-green-500/60 text-green-400'
                              : 'border-white/20 text-transparent'
                          }`}
                        >
                          <Check size={13} strokeWidth={3} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-700 text-white">
                            {TRANSACTION_TYPE_LABEL[tx.type]}
                          </span>
                          <span className="block text-[11px]" style={{ color: '#8c8c88' }}>
                            {formatTxDateTime(tx.date)}
                          </span>
                          {tx.comment.trim() ? (
                            <span
                              className="block text-[11px] leading-snug line-clamp-2"
                              style={{ color: '#c8a38e' }}
                            >
                              {tx.comment}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[13px] font-800 shrink-0" style={{ color: '#F2D8A7' }}>
                          {formatRub(tx.amount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="mt-4 space-y-2">
              {transactions.length > 0 && (
                <button
                  type="button"
                  disabled={busy || chosen.length === 0}
                  onClick={() => onPay(chosen.map((tx) => tx.id))}
                  className="w-full h-12 rounded-xl text-[14px] font-800 text-white bg-green-600 active:scale-[0.98] disabled:opacity-45 transition-transform"
                >
                  {busy ? 'Оплата…' : chosen.length === 0 ? 'Выберите позиции' : payLabel}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="w-full h-11 rounded-xl text-[13px] font-700 disabled:opacity-45"
                style={{ color: '#8c8c88' }}
              >
                {transactions.length === 0 ? 'Закрыть' : 'Отмена'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
