import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import {
  isBreakLevel,
  structureDurationLabel,
  type BlindStructure,
} from '../../data/blindStructures';

interface Props {
  open: boolean;
  /** Structure being edited: it is never offered as a source. */
  currentId: string;
  structures: BlindStructure[];
  onClose: () => void;
  onImport: (source: BlindStructure) => void;
}

function levelsLabel(structure: BlindStructure): string {
  const breaks = structure.levels.filter(isBreakLevel).length;
  const playing = structure.levels.length - breaks;
  const parts = [`${playing} уровн.`];
  if (breaks > 0) parts.push(`${breaks} перерыв${breaks === 1 ? '' : 'а'}`);
  parts.push(structureDurationLabel(structure));
  return parts.join(' · ');
}

export function ImportStructureModal({ open, currentId, structures, onClose, onImport }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sources = structures.filter((row) => row.id !== currentId);
  const selected = sources.find((row) => row.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-[460px] rounded-t-3xl p-5 bg-[#231A16]/95 backdrop-blur-md border-t border-x border-[#D99962]/30"
            style={{
              boxShadow: '0 -12px 40px rgba(0,0,0,0.6)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-structure-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="import-structure-title"
              className="text-[16px] font-900 text-white uppercase tracking-wide"
            >
              Импортировать структуру
            </h2>
            <p className="text-[12px] font-400 leading-relaxed mt-2" style={{ color: '#A39B98' }}>
              Уровни выбранной структуры заменят текущие в редакторе. Изменения попадут на часы
              только после «Сохранить».
            </p>

            {sources.length === 0 ? (
              <p className="text-[13px] font-600 text-center py-8" style={{ color: '#8c8c88' }}>
                Других структур пока нет.
              </p>
            ) : (
              <div className="mt-4 max-h-[46vh] scrollable space-y-2 pr-1">
                {sources.map((row) => {
                  const active = row.id === selectedId;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      aria-pressed={active}
                      className={`w-full flex items-center gap-3 text-left rounded-xl px-3 py-3 border transition-colors ${
                        active
                          ? 'bg-[#D99962]/15 border-[#D99962]/60'
                          : 'bg-white/[0.04] border-white/10'
                      }`}
                    >
                      <span
                        className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center ${
                          active ? 'bg-[#D99962] border-[#D99962]' : 'border-white/25'
                        }`}
                      >
                        {active && <Check size={13} strokeWidth={3} color="#0A0908" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-800 text-white truncate">
                          {row.name}
                        </span>
                        <span className="block text-[11px] font-600" style={{ color: '#A39B98' }}>
                          {levelsLabel(row)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={!selected}
                onClick={() => {
                  if (selected) onImport(selected);
                }}
                className="w-full h-12 rounded-xl text-[14px] font-800 text-[#0A0908] active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
                style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
              >
                {selected ? `Заменить уровни на «${selected.name}»` : 'Выберите структуру'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 rounded-xl text-[13px] font-700"
                style={{ color: '#8c8c88' }}
              >
                Отмена
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
