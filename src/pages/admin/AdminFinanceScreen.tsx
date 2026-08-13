import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CompactHeader } from '../../components/CompactHeader';
import { CashierTab } from './finance/CashierTab';
import { TournamentsFinanceTab } from './finance/TournamentsFinanceTab';

type Tab = 'cashier' | 'tournaments';

const TAB_ORDER: Tab[] = ['cashier', 'tournaments'];
const TAB_LABEL: Record<Tab, string> = {
  cashier: 'Касса',
  tournaments: 'Турниры',
};

export function AdminFinanceScreen() {
  const [tab, setTab] = useState<Tab>('tournaments');

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <CompactHeader
        title={
          <span className="flex flex-col">
            Finance
            <span className="tracking-[0.08em]">& Results</span>
          </span>
        }
        backTo="/profile"
        right={
          <div className="flex rounded-lg p-0.5" style={{ background: '#1E1612' }}>
            {TAB_ORDER.map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="px-3 py-1.5 text-[11px] rounded-md transition-colors duration-200"
                  style={{
                    background: active ? '#D99962' : 'transparent',
                    color: active ? '#000000' : '#6B6360',
                    fontWeight: active ? 700 : 600,
                  }}
                >
                  {TAB_LABEL[t]}
                </button>
              );
            })}
          </div>
        }
      />

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
