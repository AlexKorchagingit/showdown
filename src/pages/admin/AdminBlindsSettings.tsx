import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Pencil, Plus, Timer, Trash2 } from 'lucide-react';
import { CompactHeader } from '../../components/CompactHeader';
import { TimerSessionFields } from '../../components/TimerSessionFields';
import { useBlinds } from '../../context/BlindsContext';
import {
  buildLevels,
  DEFAULT_PAYOUTS,
  isBreakLevel,
  renumberLevels,
  structureDurationLabel,
  type BlindLevel,
  type BlindStructure,
} from '../../data/blindStructures';

const FIELD_CLASS =
  'w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#D99962]/60 transition-colors';
const LABEL_CLASS =
  'block text-[10px] font-700 uppercase tracking-[0.16em] mb-1 text-[#D99962]';

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
    <div className="space-y-4">
      <section>
        <label className={LABEL_CLASS}>Название</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Grand Opening"
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
          <label className={LABEL_CLASS}>Минуты по умолч.</label>
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
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[14px] transition-all active:scale-[0.98] ${
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

function levelTitle(level: BlindLevel): string {
  if (isBreakLevel(level) && level.isLateRegEnd) return 'ПЕРЕРЫВ · закрытие реги';
  if (isBreakLevel(level)) return 'ПЕРЕРЫВ';
  if (level.isLateRegEnd) return `Уровень ${level.level} · закрытие реги`;
  return `Уровень ${level.level}`;
}

function LevelEditor({
  structure,
  onChange,
}: {
  structure: BlindStructure;
  onChange: (levels: BlindLevel[]) => void;
}) {
  const patchLevel = (index: number, patch: Partial<BlindLevel>) => {
    onChange(
      renumberLevels(
        structure.levels.map((level, i) => {
          if (i === index) return { ...level, ...patch };
          if (patch.isLateRegEnd === true) return { ...level, isLateRegEnd: false };
          return level;
        }),
      ),
    );
  };

  const patchNumber = (
    index: number,
    key: 'smallBlind' | 'bigBlind' | 'ante' | 'durationMinutes',
    raw: string,
  ) => {
    const value = Number(raw);
    patchLevel(index, { [key]: Number.isFinite(value) ? value : 0 });
  };

  const addLevel = () => {
    const lastPlaying = [...structure.levels].reverse().find((level) => !isBreakLevel(level));
    const nextBb = lastPlaying ? lastPlaying.bigBlind * 2 : 200;
    onChange(
      renumberLevels([
        ...structure.levels,
        {
          level: structure.levels.length + 1,
          smallBlind: nextBb / 2,
          bigBlind: nextBb,
          ante: nextBb,
          durationMinutes: lastPlaying?.durationMinutes ?? structure.levelDuration,
        },
      ]),
    );
  };

  const addBreak = () => {
    const lastPlaying = [...structure.levels].reverse().find((level) => !isBreakLevel(level));
    onChange(
      renumberLevels([
        ...structure.levels,
        {
          level: 0,
          smallBlind: lastPlaying?.smallBlind || 100,
          bigBlind: lastPlaying?.bigBlind || 200,
          ante: lastPlaying?.ante || lastPlaying?.bigBlind || 200,
          durationMinutes: 15,
          isBreak: true,
        },
      ]),
    );
  };

  const removeLevel = (index: number) => {
    if (structure.levels.length <= 1) return;
    onChange(renumberLevels(structure.levels.filter((_, i) => i !== index)));
  };

  return (
    <div className="space-y-2">
      {structure.levels.map((level, index) => (
        <div
          key={`${level.level}-${index}-${isBreakLevel(level) ? 'b' : 'p'}-${level.isLateRegEnd ? 'lr' : ''}`}
          className="rounded-xl p-3 space-y-2"
          style={{
            background: level.isLateRegEnd
              ? 'rgba(244,63,94,0.10)'
              : isBreakLevel(level)
                ? 'rgba(34,197,94,0.08)'
                : '#2A211D',
            border: level.isLateRegEnd
              ? '1px solid rgba(244,63,94,0.40)'
              : isBreakLevel(level)
                ? '1px solid rgba(34,197,94,0.35)'
                : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-800 uppercase tracking-wide" style={{ color: '#D99962' }}>
              {levelTitle(level)}
            </p>
            <button
              type="button"
              onClick={() => removeLevel(index)}
              disabled={structure.levels.length <= 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30"
              aria-label={isBreakLevel(level) ? 'Удалить перерыв' : `Удалить уровень ${level.level}`}
            >
              <Trash2 size={14} style={{ color: '#A39B98' }} />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="inline-flex items-center gap-2 text-[12px] font-600 text-white/85">
              <input
                type="checkbox"
                checked={isBreakLevel(level)}
                onChange={(e) => {
                  const isBreak = e.target.checked;
                  patchLevel(
                    index,
                    isBreak
                      ? { isBreak: true }
                      : {
                          isBreak: false,
                          smallBlind: level.smallBlind || 100,
                          bigBlind: level.bigBlind || 200,
                          ante: level.ante || 200,
                        },
                  );
                }}
                className="accent-[#D99962]"
              />
              Это перерыв
            </label>
            <label className="inline-flex items-center gap-2 text-[12px] font-600 text-white/85">
              <input
                type="checkbox"
                checked={level.isLateRegEnd === true}
                onChange={(e) => patchLevel(index, { isLateRegEnd: e.target.checked })}
                className="accent-[#D99962]"
              />
              Закрытие поздней регистрации
            </label>
          </div>

          {isBreakLevel(level) ? (
            <div className="space-y-2">
              <p className="text-[15px] font-900 uppercase tracking-[0.18em] text-white">
                ПЕРЕРЫВ
              </p>
              <label className="block max-w-[8rem]">
                <span className="block text-[9px] font-700 uppercase tracking-wide mb-1 text-white/40">
                  Мин
                </span>
                <input
                  type="number"
                  value={level.durationMinutes}
                  onChange={(e) => patchNumber(index, 'durationMinutes', e.target.value)}
                  className={FIELD_CLASS}
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  ['smallBlind', 'SB'],
                  ['bigBlind', 'BB'],
                  ['ante', 'Ante'],
                  ['durationMinutes', 'Мин'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="min-w-0">
                  <span className="block text-[9px] font-700 uppercase tracking-wide mb-1 text-white/40">
                    {label}
                  </span>
                  <input
                    type="number"
                    value={level[key]}
                    onChange={(e) => patchNumber(index, key, e.target.value)}
                    className={FIELD_CLASS}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={addLevel}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-700"
          style={{
            background: 'rgba(217,153,98,0.1)',
            border: '1px solid rgba(217,153,98,0.3)',
            color: '#D99962',
          }}
        >
          <Plus size={16} strokeWidth={2.4} />
          Добавить уровень
        </button>
        <button
          type="button"
          onClick={addBreak}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-700"
          style={{
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            color: '#86efac',
          }}
        >
          <Plus size={16} strokeWidth={2.4} />
          Перерыв
        </button>
      </div>
    </div>
  );
}

export function AdminBlindsSettings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    structures,
    addStructure,
    updateLevels,
    activeStructureId,
    isRunning,
  } = useBlinds();
  const [isCreating, setIsCreating] = useState(false);

  const requestedId = searchParams.get('structure');
  const editing = useMemo(
    () => structures.find((s) => s.id === requestedId) ?? null,
    [structures, requestedId],
  );

  const openTimer = (id: string) => navigate(`/admin/blinds/timer?structure=${id}`);
  const openEditor = (id: string) => navigate(`/admin/blinds/settings?structure=${id}`);

  const handleCreate = (form: CreateForm) => {
    const duration = Number(form.levelDuration) || 20;
    const created: BlindStructure = {
      id: `bs-${Date.now()}`,
      name: form.name.trim(),
      levelDuration: duration,
      guarantee: Number(form.guarantee) || 0,
      levels: buildLevels(Math.max(1, Number(form.levelCount) || 12), 200, duration),
      payouts: DEFAULT_PAYOUTS,
    };

    addStructure(created);
    setIsCreating(false);
    openEditor(created.id);
  };

  const backFromEditor = () => {
    if (activeStructureId && editing && activeStructureId === editing.id) {
      navigate(`/admin/blinds/timer?structure=${editing.id}`);
      return;
    }
    navigate('/admin/blinds/settings');
  };

  if (editing) {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
        <CompactHeader
          title={editing.name}
          onBack={backFromEditor}
          right={
            <button
              type="button"
              onClick={() => openTimer(editing.id)}
              className="h-10 px-3 rounded-full text-[11px] font-800 uppercase tracking-wide"
              style={{
                background: 'linear-gradient(to right, #8C4C27, #D99962)',
                color: '#0A0908',
              }}
            >
              Таймер
            </button>
          }
        />

        <div
          className="flex-1 scrollable px-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
        >
          {isRunning && activeStructureId === editing.id && (
            <p className="text-[11px] font-600 mb-3 px-1" style={{ color: '#D99962' }}>
              Таймер идёт. Изменения предстоящих уровней подхватятся сразу.
            </p>
          )}
          <TimerSessionFields structureName={editing.name} />
          <LevelEditor
            structure={editing}
            onChange={(levels) => updateLevels(editing.id, levels)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <CompactHeader title="Blinds info" backTo="/profile" />

      <div
        className="flex-1 scrollable px-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <TimerSessionFields structureName={structures.find((s) => s.id === activeStructureId)?.name} />
        <div className="space-y-2">
          {structures.map((structure) => (
            <div
              key={structure.id}
              className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
              style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <button
                type="button"
                onClick={() => openTimer(structure.id)}
                className="flex-1 flex items-center gap-3 min-w-0 text-left"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(140,76,39,0.22)' }}
                >
                  <Timer size={16} strokeWidth={2.2} style={{ color: '#D99962' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-white truncate">{structure.name}</p>
                  <p className="text-[11px] font-500" style={{ color: '#8c8c88' }}>
                    {structure.levels.filter((l) => !isBreakLevel(l)).length} ур.
                    {structure.levels.some((l) => isBreakLevel(l)) ? ' · перерыв' : ''}
                    {structure.levels.some((l) => l.isLateRegEnd) ? ' · конец реги' : ''} ·{' '}
                    {structureDurationLabel(structure)} · {structure.guarantee.toLocaleString('ru-RU')}
                  </p>
                </div>
                <ChevronRight size={16} strokeWidth={2.4} style={{ color: '#D99962' }} />
              </button>
              <button
                type="button"
                onClick={() => openEditor(structure.id)}
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)' }}
                aria-label={`Редактировать ${structure.name}`}
              >
                <Pencil size={14} style={{ color: '#D99962' }} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsCreating((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-xl text-[14px] font-700 active:scale-[0.98] transition-transform"
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
              <div className="pt-4">
                <CreateStructureForm onCreate={handleCreate} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
