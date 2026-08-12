import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { CashierTab } from './finance/CashierTab';
import { TournamentsFinanceTab } from './finance/TournamentsFinanceTab';
import { DebtorsTab } from './finance/DebtorsTab';

type Tab = 'cashier' | 'tournaments' | 'debtors';

const TAB_ORDER: Tab[] = ['cashier', 'tournaments', 'debtors'];
const TAB_LABEL: Record<Tab, string> = {
  cashier: 'Касса',
  tournaments: 'Турниры',
  debtors: 'Должники',
};

export function AdminFinanceScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('tournaments');

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="absolute top-4 left-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
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

      <div className="flex-shrink-0 px-5 pt-20 pb-4 space-y-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          Finance & Results
        </h1>

        <div className="relative flex rounded-xl p-1" style={{ background: '#1E1612' }}>
          {TAB_ORDER.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`relative flex-1 py-2.5 text-[11px] rounded-lg transition-colors duration-200 ${
                  active ? 'font-bold text-black' : 'font-600'
                }`}
                style={{
                  background: active ? '#D99962' : 'transparent',
                  color: active ? '#000000' : '#6B6360',
                }}
              >
                {TAB_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'cashier' && <CashierTab />}
            {tab === 'tournaments' && <TournamentsFinanceTab />}
            {tab === 'debtors' && <DebtorsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
