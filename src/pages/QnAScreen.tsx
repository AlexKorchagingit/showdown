import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { SectionScreen } from '../components/SectionScreen';
import { QA_ITEMS } from '../data/qa';

export function QnAScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SectionScreen title="Q&A" backTo="/">
      {QA_ITEMS.map((item, index) => {
        const open = openIndex === index;

        return (
          <div key={item.question} className="mb-3 rounded-xl overflow-hidden bg-[#231A16]">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : index)}
              aria-expanded={open}
              className="w-full p-4 flex justify-between items-center text-white font-bold text-left gap-3 active:opacity-90 transition-opacity"
            >
              <span className="text-[14px] leading-snug">{item.question}</span>
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
                  <p className="text-[#8c8c88] text-sm px-4 pb-4 leading-relaxed">{item.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </SectionScreen>
  );
}
