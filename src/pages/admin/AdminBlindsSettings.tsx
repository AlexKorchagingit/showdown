import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Plus, Timer } from 'lucide-react';
import {
  addBlindStructure,
  BLIND_STRUCTURES,
  buildLevels,
  DEFAULT_PAYOUTS,
  type BlindStructure,
} from '../../data/blindStructures';

const FIELD_CLASS =
  'w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#D99962]/60 transition-colors';
const LABEL_CLASS =
  'block text-[11px] font-700 uppercase tracking-[0.18em] mb-2 text-[#D99962]';

interface CreateForm {
  name: string;
  levelCount: string;
  levelDuration: string;
  guarantee: string;
}

const EMPTY_FORM: CreateForm = {
  name: '',
  levelCount: '12',
  levelDuration: '20',
  guarantee: '20000',
};

function CreateStructureForm({ onCreate }: { onCreate: (form: CreateForm) => void }) {
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);

  const set = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isValid = form.name.trim().length > 0;

  return (
    <div className="space-y-5">
      <section>
        <label className={LABEL_CLASS}>Название</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="ROYAL FREEZEOUT"
          className={FIELD_CLASS}
        />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <section>
          <label className={LABEL_CLASS}>Уровней</label>
          <input
            type="number"
            value={form.levelCount}
            onChange={(e) => set('levelCount', e.target.value)}
            className={FIELD_CLASS}
          />
        </section>
        <section>
          <label className={LABEL_CLASS}>Длина, мин</label>
          <input
            type="number"
            value={form.levelDuration}
            onChange={(e) => set('levelDuration', e.target.value)}
            className={FIELD_CLASS}
          />
        </section>
      </div>

      <section>
        <label className={LABEL_CLASS}>Гарантия очков</label>
        <input
          type="number"
          value={form.guarantee}
          onChange={(e) => set('guarantee', e.target.value)}
          className={FIELD_CLASS}
        />
      </section>

      <button
        type="button"
        disabled={!isValid}
        onClick={() => {
          onCreate(form);
          setForm(EMPTY_FORM);
        }}
        className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-[15px] transition-all active:scale-[0.98] ${
          isValid ? 'text-[#0A0908]' : 'opacity-50 cursor-not-allowed bg-[#463129] text-white/50'
        }`}
        style={
          isValid
            ? {
                background: 'linear-gradient(to right, #8C4C27, #D99962)',
                boxShadow: '0 0 16px rgba(217,153,98,0.28)',
              }
            : undefined
        }
      >
        <Plus size={18} strokeWidth={2.5} />
        Создать структуру
      </button>
    </div>
  );
}

function StructureRow({
  structure,
  onOpen,
}: {
  structure: BlindStructure;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left active:scale-[0.98] transition-transform"
      style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(140,76,39,0.22)' }}
      >
        <Timer size={18} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-white truncate">{structure.name}</p>
        <p className="text-[11px] font-500" style={{ color: '#8c8c88' }}>
          {structure.levels.length} уровней · {structure.levelDuration} мин ·{' '}
          {structure.guarantee.toLocaleString('ru-RU')} очков
        </p>
      </div>

      <ChevronRight size={18} strokeWidth={2.4} style={{ color: '#D99962' }} />
    </button>
  );
}

export function AdminBlindsSettings() {
  const navigate = useNavigate();
  const [structures, setStructures] = useState<BlindStructure[]>(BLIND_STRUCTURES);
  const [isCreating, setIsCreating] = useState(false);

  const openTimer = (id: string) => navigate(`/admin/blinds/timer?structure=${id}`);

  const handleCreate = (form: CreateForm) => {
    const created: BlindStructure = {
      id: `bs-${Date.now()}`,
      name: form.name.trim().toUpperCase(),
      levelDuration: Number(form.levelDuration) || 20,
      guarantee: Number(form.guarantee) || 0,
      levels: buildLevels(Math.max(1, Number(form.levelCount) || 12)),
      payouts: DEFAULT_PAYOUTS,
    };

    addBlindStructure(created);
    setStructures([...BLIND_STRUCTURES]);
    setIsCreating(false);
    openTimer(created.id);
  };

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

      <div className="flex-shrink-0 px-5 pt-20 pb-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          Blinds info
        </h1>
      </div>

      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <div className="space-y-3">
          {structures.map((structure) => (
            <StructureRow
              key={structure.id}
              structure={structure}
              onOpen={() => openTimer(structure.id)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsCreating((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-3.5 mt-5 rounded-xl text-[14px] font-700 active:scale-[0.98] transition-transform"
          style={{
            background: 'linear-gradient(to right, #2A211D, #463129)',
            border: '1px solid rgba(217,153,98,0.35)',
            color: '#D99962',
          }}
        >
          <Plus size={17} strokeWidth={2.4} />
          Создать структуру
        </button>

        <AnimatePresence initial={false}>
          {isCreating && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-5">
                <CreateStructureForm onCreate={handleCreate} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
