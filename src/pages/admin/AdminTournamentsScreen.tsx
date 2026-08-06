import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTournaments } from '../../context/TournamentContext';
import { TournamentCard } from '../../components/TournamentCard';
import { FeatureListEditor } from '../../components/admin/FeatureListEditor';
import { compareByStart, isFinished } from '../../lib/tournamentStatus';
import { asset } from '../../lib/assets';
import type { Tournament } from '../../types/tournament';

type Tab = 'all' | 'create';

const TAB_ORDER: Tab[] = ['all', 'create'];
const TAB_LABEL: Record<Tab, string> = {
  all: 'Все турниры',
  create: 'Создать турнир',
};

const FIELD_CLASS =
  'w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-[#D99962]/60 transition-colors';
const LABEL_CLASS =
  'block text-[11px] font-700 uppercase tracking-[0.18em] mb-2 text-[#D99962]';

const CLUB_ADDRESS = 'г. Брянск, Проспект Ленина, 2';

interface CreateForm {
  title: string;
  startDate: string;
  startTime: string;
  totalSeats: string;
  guarantee: string;
  about: string;
  features: string[];
}

const EMPTY_FORM: CreateForm = {
  title: '',
  startDate: '',
  startTime: '19:00',
  totalSeats: '36',
  guarantee: '20000',
  about: '',
  features: [],
};

function CreateTournamentForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { addTournament } = useTournaments();
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);

  const set = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isValid = form.title.trim().length > 0 && form.startDate.length > 0;

  const handleCreate = () => {
    if (!isValid) return;

    const newTournament: Omit<Tournament, 'id'> = {
      title: form.title.trim().toUpperCase(),
      imageUrl: asset('/fishka.webp'),
      address: CLUB_ADDRESS,
      startDate: form.startDate,
      startTime: form.startTime || '19:00',
      totalSeats: Number(form.totalSeats) || 36,
      guarantee: Number(form.guarantee) || 0,
      about: form.about.trim(),
      features: form.features,
      participants: [],
      lateRegUntil: '22:45',
      blindStructure: 'Плавная',
      stackSize: 50000,
      levelDuration: '20/18 мин',
    };

    const id = addTournament(newTournament);
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

      <button
        type="button"
        onClick={handleCreate}
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
  const [tab, setTab] = useState<Tab>('all');

  // Upcoming first (soonest at the top), finished ones below in reverse order
  const sortedTournaments = [...tournaments].sort((a, b) => {
    const aFinished = isFinished(a);
    if (aFinished !== isFinished(b)) return aFinished ? 1 : -1;
    return aFinished ? compareByStart(b, a) : compareByStart(a, b);
  });

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
      >
        <ArrowLeft size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <div className="flex-shrink-0 px-5 pt-20 pb-4 space-y-4">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          Tournaments
        </h1>

        <div className="relative flex rounded-xl p-1" style={{ background: '#1E1612' }}>
          {TAB_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="relative flex-1 py-2.5 text-[13px] font-600 rounded-lg transition-colors duration-200"
              style={{ color: tab === t ? '#0A0908' : '#6B6360' }}
            >
              {tab === t && (
                <motion.span
                  layoutId="admin-tour-tab"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.38 }}
                />
              )}
              <span className="relative z-10">{TAB_LABEL[t]}</span>
            </button>
          ))}
        </div>
      </div>

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
                {sortedTournaments.map((tournament) => (
                  <div
                    key={tournament.id}
                    className={isFinished(tournament) ? 'opacity-50 grayscale' : ''}
                  >
                    <TournamentCard
                      tournament={tournament}
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
