import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { CashierTab } from './finance/CashierTab';
import { TournamentsFinanceTab } from './finance/TournamentsFinanceTab';

type Tab = 'cashier' | 'tournaments';

const TAB_ORDER: Tab[] = ['cashier', 'tournaments'];
const TAB_LABEL: Record<Tab, string> = {
  cashier: 'Касса',
  tournaments: 'Турниры',
};

export function AdminFinanceScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('tournaments');

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <div className="flex-shrink-0 px-5 pt-4 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(28,20,16,0.78)',
              border: '1px solid rgba(217,153,98,0.28)',
            }}
            aria-label="Назад"
          >
            <ArrowLeft size={20} strokeWidth={2.2} style={{ color: '#D99962' }} />
          </button>
          <h1 className="flex-1 text-center text-[15px] font-800 tracking-[0.2em] text-white uppercase pr-11">
            Finance & Results
          </h1>
        </div>

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
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
