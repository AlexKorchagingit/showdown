import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Plus } from 'lucide-react';
import { useTournaments } from '../../context/TournamentContext';
import { TournamentCard } from '../../components/TournamentCard';
import { CompactHeader } from '../../components/CompactHeader';
import { FeatureListEditor } from '../../components/admin/FeatureListEditor';
import { BountyCheckbox } from '../../components/admin/BountyCheckbox';
import { BlindStructurePicker } from '../../components/admin/BlindStructurePicker';
import { compareByStart, isFinished } from '../../lib/tournamentStatus';
import { exportTournamentsToCSV, tournamentExportFilename } from '../../lib/exportToCSV';
import { formatIsoDay, startOfDay } from '../../lib/financePeriod';
import { filterTournamentsByStartDate, statsPeriodBounds } from '../../lib/statsPeriod';
import { asset } from '../../lib/assets';
import { DEFAULT_TOTAL_SEATS, type Tournament } from '../../types/tournament';
import { useBlinds } from '../../context/BlindsContext';

type Tab = 'all' | 'create';

const TAB_ORDER: Tab[] = ['all', 'create'];
const TAB_LABEL: Record<Tab, string> = {
  all: 'Все',
  create: 'Создать',
};

const FIELD_CLASS =
  'w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#D99962]/60 transition-colors';
const LABEL_CLASS =
  'block text-[11px] font-700 uppercase tracking-[0.18em] mb-2 text-[#D99962]';

const CLUB_ADDRESS = 'г. Брянск, Проспект Ленина, 2';

type ExportPresetId = 'today' | 'week' | 'month' | 'all';
type ExportPreset = ExportPresetId | 'custom';

const EXPORT_PRESETS: { id: ExportPresetId; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'all', label: 'Все время' },
];

function initialMonthRange(now = new Date()): { from: string; to: string } {
  const bounds = statsPeriodBounds('month', now);
  if (!bounds) return { from: '', to: '' };
  return { from: formatIsoDay(bounds.start), to: formatIsoDay(bounds.end) };
}

function TournamentExportBar({ tournaments }: { tournaments: Tournament[] }) {
  const month = initialMonthRange();
  const [preset, setPreset] = useState<ExportPreset>('month');
  const [fromDate, setFromDate] = useState(month.from);
  const [toDate, setToDate] = useState(month.to);

  const applyPreset = (next: ExportPresetId) => {
    setPreset(next);
    const now = new Date();
    if (next === 'all') {
      setFromDate('');
      setToDate('');
      return;
    }
    if (next === 'today') {
      const day = formatIsoDay(startOfDay(now));
      setFromDate(day);
      setToDate(day);
      return;
    }
    const bounds = statsPeriodBounds(next, now);
    if (!bounds) return;
    setFromDate(formatIsoDay(bounds.start));
    setToDate(formatIsoDay(bounds.end));
  };

  const exportRows = useMemo(
    () => filterTournamentsByStartDate(tournaments, fromDate, toDate),
    [tournaments, fromDate, toDate],
  );

  return (
    <section
      className="rounded-2xl p-3 space-y-3"
      style={{ background: '#2A211D', border: '1px solid rgba(217,153,98,0.22)' }}
    >
      <p className="text-[11px] font-700 uppercase tracking-[0.16em]" style={{ color: '#D99962' }}>
        Выгрузка в Excel
      </p>
      <div className="grid grid-cols-4 gap-1 rounded-xl p-1" style={{ background: '#1E1612' }}>
        {EXPORT_PRESETS.map(({ id, label }) => {
          const active = preset === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className="py-2.5 rounded-lg text-[11px] font-700 leading-tight transition-colors"
              style={{
                background: active ? 'linear-gradient(to right, #8C4C27, #D99962)' : 'transparent',
                color: active ? '#0A0908' : '#6B6360',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <section>
          <label className={LABEL_CLASS}>С</label>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setPreset('custom');
              setFromDate(event.target.value);
            }}
            className={`${FIELD_CLASS} [color-scheme:dark]`}
          />
        </section>
        <section>
          <label className={LABEL_CLASS}>По</label>
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setPreset('custom');
              setToDate(event.target.value);
            }}
            className={`${FIELD_CLASS} [color-scheme:dark]`}
          />
        </section>
      </div>
      <button
        type="button"
        disabled={exportRows.length === 0}
        onClick={() =>
          exportTournamentsToCSV(exportRows, tournamentExportFilename(fromDate, toDate))
        }
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-700 text-[#0A0908] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        style={{
          background: 'linear-gradient(to right, #8C4C27, #D99962)',
          boxShadow: exportRows.length === 0 ? undefined : '0 0 16px rgba(217,153,98,0.28)',
        }}
      >
        <Download size={17} strokeWidth={2.4} />
        Экспорт в Excel (CSV)
      </button>
      <p className="text-[12px] px-0.5" style={{ color: '#8c8c88' }}>
        {exportRows.length === 0
          ? 'Нет турниров за выбранный период'
          : `К выгрузке: ${exportRows.length}`}
      </p>
    </section>
  );
}

interface CreateForm {
  title: string;
  startDate: string;
  startTime: string;
  totalSeats: string;
  guarantee: string;
  about: string;
  features: string[];
  isBounty: boolean;
  blindStructureId: string;
}

const EMPTY_FORM: CreateForm = {
  title: '',
  startDate: '',
  startTime: '19:00',
  totalSeats: String(DEFAULT_TOTAL_SEATS),
  guarantee: '20000',
  about: '',
  features: [],
  isBounty: false,
  blindStructureId: '',
};

function CreateTournamentForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { addTournament } = useTournaments();
  const { structures } = useBlinds();
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);

  const set = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isValid = form.title.trim().length > 0 && form.startDate.length > 0;
  const selectedStructure =
    structures.find((row) => row.id === form.blindStructureId) ?? structures[0];

  const handleCreate = async () => {
    if (!isValid) return;

    const newTournament: Omit<Tournament, 'id'> = {
      title: form.title.trim().toUpperCase(),
      imageUrl: asset('/tournaments/ticket.webp'),
      address: CLUB_ADDRESS,
      startDate: form.startDate,
      startTime: form.startTime || '19:00',
      totalSeats: Number(form.totalSeats) || DEFAULT_TOTAL_SEATS,
      guarantee: Number(form.guarantee) || 0,
      about: form.about.trim(),
      features: form.features,
      isBounty: form.isBounty,
      participants: [],
      lateRegUntil: '22:45',
      blindStructure: selectedStructure?.name ?? 'Плавная',
      blindStructureId: selectedStructure?.id,
      stackSize: 50000,
      levelDuration: selectedStructure ? `${selectedStructure.levelDuration} мин` : '20/18 мин',
      isClosed: false,
    };

    const id = await addTournament(newTournament);
    if (!id) return;
    setForm(EMPTY_FORM);
    onCreated(id);
  };

  return (
    <div className="space-y-5">
      <section>
        <label className={LABEL_CLASS}>Название</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="ROYAL FREEZEOUT"
          className={FIELD_CLASS}
        />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <section>
          <label className={LABEL_CLASS}>Дата</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            className={`${FIELD_CLASS} [color-scheme:dark]`}
          />
        </section>
        <section>
          <label className={LABEL_CLASS}>Время</label>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => set('startTime', e.target.value)}
            className={`${FIELD_CLASS} [color-scheme:dark]`}
          />
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <section>
          <label className={LABEL_CLASS}>Всего мест</label>
          <input
            type="number"
            value={form.totalSeats}
            onChange={(e) => set('totalSeats', e.target.value)}
            className={FIELD_CLASS}
          />
        </section>
        <section>
          <label className={LABEL_CLASS}>Гарантия</label>
          <input
            type="number"
            value={form.guarantee}
            onChange={(e) => set('guarantee', e.target.value)}
            className={FIELD_CLASS}
          />
        </section>
      </div>

      <section>
        <label className={LABEL_CLASS}>О турнире</label>
        <textarea
          value={form.about}
          rows={4}
          onChange={(e) => set('about', e.target.value)}
          placeholder="Расскажите об этом турнире"
          className={`${FIELD_CLASS} resize-none`}
        />
      </section>

      <section>
        <label className={LABEL_CLASS}>Особенности (пунктами)</label>
        <FeatureListEditor
          features={form.features}
          onChange={(features) => set('features', features)}
        />
      </section>

      <section>
        <BountyCheckbox checked={form.isBounty} onChange={(checked) => set('isBounty', checked)} />
      </section>

      <section>
        <BlindStructurePicker
          structureId={selectedStructure?.id}
          structureName={selectedStructure?.name}
          onChange={(next) => set('blindStructureId', next.blindStructureId)}
        />
      </section>

      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={!isValid}
        className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-[15px] transition-all active:scale-[0.98] ${
          isValid
            ? 'text-[#0A0908]'
            : 'opacity-50 cursor-not-allowed bg-[#463129] text-white/50'
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
        Создать турнир
      </button>
    </div>
  );
}

export function AdminTournamentsScreen() {
  const navigate = useNavigate();
  const { tournaments } = useTournaments();
  const { isRunning, linkedTournamentId } = useBlinds();
  const [tab, setTab] = useState<Tab>('all');

  // Upcoming first (soonest at the top), finished ones below in reverse order
  const sortedTournaments = [...tournaments].sort((a, b) => {
    const aFinished = isFinished(a);
    if (aFinished !== isFinished(b)) return aFinished ? 1 : -1;
    return aFinished ? compareByStart(b, a) : compareByStart(a, b);
  });

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <CompactHeader
        title="Tournaments"
        backTo="/profile"
        right={
          <div className="relative flex rounded-lg p-0.5 min-w-0" style={{ background: '#1E1612' }}>
            {TAB_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="relative px-3 py-1.5 text-[11px] font-700 rounded-md transition-colors duration-200"
                style={{ color: tab === t ? '#0A0908' : '#6B6360' }}
              >
                {tab === t && (
                  <motion.span
                    layoutId="admin-tour-tab"
                    className="absolute inset-0 rounded-md"
                    style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.38 }}
                  />
                )}
                <span className="relative z-10">{TAB_LABEL[t]}</span>
              </button>
            ))}
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            {tab === 'all' ? (
              <div className="space-y-3">
                <TournamentExportBar tournaments={tournaments} />
                {sortedTournaments.map((tournament) => (
                  <div
                    key={tournament.id}
                    className={isFinished(tournament) ? 'opacity-50 grayscale' : ''}
                  >
                    <TournamentCard
                      tournament={tournament}
                      timerRunning={isRunning && linkedTournamentId === tournament.id}
                      onClick={(t) => navigate(`/admin/tournaments/${t.id}`)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-1">
                <CreateTournamentForm
                  onCreated={(id) => navigate(`/admin/tournaments/${id}`)}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
