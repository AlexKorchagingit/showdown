import { useMemo, useState } from 'react';
import { Gem, Plus, Users } from 'lucide-react';
import { CompactHeader } from '../../components/CompactHeader';
import { CoinBalance } from '../../components/CoinBalance';
import { useProfile } from '../../context/ProfileContext';
import { useUser } from '../../context/UserContext';
import {
  grantRubies,
  grantRubiesToEveryone,
  readRubyAccounts,
} from '../../lib/rubyGrants';

const FIELD_CLASS =
  'w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#D99962]/60 transition-colors';
const LABEL_CLASS =
  'block text-[11px] font-700 uppercase tracking-[0.18em] mb-2 text-[#D99962]';

type GrantTarget =
  | { kind: 'one'; email: string; nickname: string }
  | { kind: 'all' };

export function AdminRubyScreen() {
  const { email } = useUser();
  const { coins, addCoins } = useProfile();
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState<GrantTarget | null>(null);
  const [amount, setAmount] = useState('100');
  const [comment, setComment] = useState('');

  const accounts = useMemo(() => {
    return readRubyAccounts().map((account) =>
      account.email.trim().toLowerCase() === email.trim().toLowerCase()
        ? { ...account, coins }
        : account,
    );
  }, [email, coins, revision]);

  const parsedAmount = Math.floor(Number(amount));
  const canSave = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const closeModal = () => {
    setTarget(null);
    setAmount('100');
    setComment('');
  };

  const handleSave = () => {
    if (!canSave || !target) return;
    const message = comment.trim() || 'Подарок от клуба';
    if (target.kind === 'all') {
      grantRubiesToEveryone({
        amount: parsedAmount,
        message,
        currentEmail: email,
        creditCurrentUser: addCoins,
      });
    } else {
      grantRubies({
        email: target.email,
        amount: parsedAmount,
        message,
        currentEmail: email,
        creditCurrentUser: addCoins,
      });
    }
    setRevision((value) => value + 1);
    closeModal();
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <CompactHeader
        title="Ruby"
        backTo="/profile"
        right={
          <button
            type="button"
            onClick={() => setTarget({ kind: 'all' })}
            className="h-9 px-3 rounded-lg text-[11px] font-800 uppercase tracking-wide active:scale-[0.97]"
            style={{
              background: 'linear-gradient(to right, #8C4C27, #D99962)',
              color: '#0A0908',
            }}
          >
            Начислить всем
          </button>
        }
      />

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <p className="text-[12px] font-500 mb-3 px-1" style={{ color: '#6B6360' }}>
          Начисление рубинов. Онлайн-игрок получает баланс сразу, остальные — попап при входе.
        </p>

        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
              style={{ background: '#231A16', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(140,76,39,0.28)', color: '#c8a38e' }}
              >
                <Gem size={16} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-700 text-[15px] truncate">{account.nickname}</p>
                <p className="text-[12px] font-500 truncate" style={{ color: '#8c8c88' }}>
                  {account.email}
                </p>
                {account.pendingAmount > 0 && (
                  <p className="text-[11px] font-700 mt-0.5" style={{ color: '#86efac' }}>
                    Ожидает: +{account.pendingAmount.toLocaleString('ru-RU')}
                  </p>
                )}
              </div>
              <CoinBalance coins={account.coins} compact />
              <button
                type="button"
                onClick={() =>
                  setTarget({ kind: 'one', email: account.email, nickname: account.nickname })
                }
                className="shrink-0 h-9 px-2.5 rounded-lg text-[11px] font-800 active:scale-[0.97]"
                style={{
                  background: 'rgba(217,153,98,0.14)',
                  border: '1px solid rgba(217,153,98,0.4)',
                  color: '#F2D8A7',
                }}
              >
                + Начислить
              </button>
            </div>
          ))}
        </div>
      </div>

      {target && (
        <div className="absolute inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/65"
            aria-label="Закрыть"
            onClick={closeModal}
          />
          <div
            className="relative w-full rounded-t-3xl px-4 pt-4 pb-8"
            style={{
              background: '#1A1411',
              border: '1px solid rgba(217,153,98,0.28)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
            }}
          >
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-4">
              {target.kind === 'all' ? <Users size={18} style={{ color: '#D99962' }} /> : <Gem size={18} style={{ color: '#D99962' }} />}
              <h2 className="text-[15px] font-800 uppercase tracking-wide text-white">
                {target.kind === 'all' ? 'Начислить всем' : target.nickname}
              </h2>
            </div>

            <section className="mb-4">
              <label className={LABEL_CLASS}>Сумма рубинов</label>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={FIELD_CLASS}
              />
            </section>
            <section className="mb-5">
              <label className={LABEL_CLASS}>Комментарий (за что?)</label>
              <input
                type="text"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="День рождения клуба"
                className={FIELD_CLASS}
              />
            </section>

            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className={`w-full h-12 rounded-xl text-[15px] font-800 transition-transform ${
                canSave ? 'text-[#0A0908] active:scale-[0.98]' : 'opacity-45 cursor-not-allowed text-white/50'
              }`}
              style={
                canSave
                  ? { background: 'linear-gradient(to right, #8C4C27, #D99962)' }
                  : { background: '#463129' }
              }
            >
              Начислить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
