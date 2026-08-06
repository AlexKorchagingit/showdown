import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, HelpCircle, Sparkles } from 'lucide-react';
import { SectionScreen } from '../components/SectionScreen';
import { QA_ITEMS } from '../data/qa';

export function QnAScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SectionScreen title="Q&A" backTo="/">
      <div
        className="relative rounded-2xl p-5 mb-6 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #2A211D 0%, #231A16 50%, #110b09 100%)',
          border: '1px solid rgba(217,153,98,0.35)',
          boxShadow: '0 0 28px rgba(217,153,98,0.12)',
        }}
      >
        <div
          className="absolute -right-8 -top-8 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(217,153,98,0.25), transparent 70%)' }}
        />
        <div className="relative flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(140,76,39,0.5), rgba(217,153,98,0.25))',
              border: '1px solid rgba(217,153,98,0.4)',
            }}
          >
            <HelpCircle size={22} strokeWidth={2} className="text-[#F2D8A7]" />
          </div>
          <div>
            <p className="text-[11px] font-800 tracking-[0.28em] uppercase text-[#D99962] mb-1">
              Частые вопросы
            </p>
            <p className="text-[14px] font-600 text-white/90 leading-snug">
              Всё о формате, записи, рейтинге и правилах клуба — в одном месте.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {QA_ITEMS.map((item, index) => {
          const open = openIndex === index;
          const isHighlight = item.question.includes('Финал месяца');

          return (
            <div
              key={item.question}
              className={`rounded-xl overflow-hidden transition-shadow ${
                open ? 'shadow-[0_0_20px_rgba(217,153,98,0.2)]' : ''
              }`}
              style={{
                background: isHighlight
                  ? 'linear-gradient(160deg, rgba(70,49,41,0.9) 0%, #231A16 60%)'
                  : '#231A16',
                border: open
                  ? '1px solid rgba(217,153,98,0.55)'
                  : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : index)}
                aria-expanded={open}
                className="w-full p-4 flex justify-between items-center text-left gap-3 active:opacity-90 transition-opacity"
              >
                <span className="flex items-start gap-3 min-w-0">
                  <span
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-800 tabular-nums"
                    style={{
                      background: open ? 'rgba(217,153,98,0.25)' : 'rgba(140,76,39,0.2)',
                      color: open ? '#F2D8A7' : '#D99962',
                      border: '1px solid rgba(217,153,98,0.3)',
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[14px] font-bold text-white leading-snug pt-0.5">
                    {isHighlight && (
                      <Sparkles
                        size={13}
                        className="inline-block mr-1.5 -mt-0.5 text-[#D99962]"
                        strokeWidth={2.2}
                      />
                    )}
                    {item.question}
                  </span>
                </span>
                <ChevronDown
                  size={20}
                  strokeWidth={2.2}
                  className={`text-[#D99962] shrink-0 transition-transform duration-300 ${
                    open ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div
                      className="mx-4 mb-4 px-4 py-3 rounded-lg text-sm leading-relaxed"
                      style={{
                        background: 'rgba(17,11,9,0.65)',
                        border: '1px solid rgba(217,153,98,0.15)',
                        color: '#C9C2BC',
                      }}
                    >
                      {item.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </SectionScreen>
  );
}
