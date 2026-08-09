import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Calendar, Clock, ImagePlus, Plus, Star, Trash2, UserPlus, X,
} from 'lucide-react';
import type { Participant, Tournament } from '../../types/tournament';
import { useTournaments } from '../../context/TournamentContext';
import { mockUsers } from '../../data/mockUsers';
import { ALL_PARTICIPANTS } from '../../data/participants';
import { isFinished as hasFinished, sortByRating } from '../../lib/tournamentStatus';
import { EditableText } from '../../components/admin/EditableText';
import { FeatureListEditor } from '../../components/admin/FeatureListEditor';
import { CURRENT_USER_RATING } from '../../types/player';

/** Season rating from the global player pool (read-only in lobby admin). */
function resolveSeasonRating(nickname: string): number {
  const fromPool = ALL_PARTICIPANTS.find((p) => p.nickname === nickname);
  if (fromPool) return fromPool.rating;
  if (nickname === CURRENT_USER_RATING.nickname) return CURRENT_USER_RATING.points;
  return 0;
}

const CARD_STYLE = {
  background: '#2A211D',
  border: '1px solid rgba(255,255,255,0.06)',
} as const;

const SECTION_TITLE = 'text-[12px] font-700 uppercase tracking-[0.2em]';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ── Hero with editable title, date, time and photo ─────────────────────── */
function EditableHero({
  tournament,
  photoOverride,
  onPatch,
  onPickPhoto,
}: {
  tournament: Tournament;
  photoOverride: string | null;
  onPatch: (patch: Partial<Tournament>) => void;
  onPickPhoto: () => void;
}) {
  const heroImage = photoOverride ?? tournament.imageUrl;
  const isCustomPhoto = photoOverride !== null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl mx-4 mt-4"
      style={{ minHeight: 180, background: '#1d0b07' }}
    >
      <div className="absolute inset-0 z-0 overflow-hidden border-0 shadow-none ring-0 divide-x-0 bg-transparent">
        <img
          src={heroImage}
          alt=""
          aria-hidden
          className={`absolute pointer-events-none select-none border-0 shadow-none ring-0 outline-none ${
            isCustomPhoto
              ? 'inset-0 w-full h-full object-cover'
              : 'top-1/2 -translate-y-1/2 right-0 h-[120%] w-auto max-w-none object-right object-contain origin-right scale-75'
          }`}
          style={
            isCustomPhoto
              ? {
                  opacity: 0.65,
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 28%, black 55%)',
                  maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 28%, black 55%)',
                }
              : {
                  opacity: 0.8,
                  filter: 'brightness(1.12) contrast(1.06) saturate(1.08)',
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 28%, black 55%)',
                  maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 28%, black 55%)',
                }
          }
        />
        <div className="absolute inset-0 pointer-events-none border-0 shadow-none ring-0 bg-gradient-to-r from-[#1d0b07] via-[#1d0b07]/80 via-35% to-transparent" />
      </div>

      {/* Photo edit button */}
      <button
        type="button"
        onClick={onPickPhoto}
        aria-label="Изменить фото"
        className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
        style={{
          background: 'rgba(28,20,16,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(217,153,98,0.4)',
        }}
      >
        <ImagePlus size={18} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <div className="relative z-20 px-6 pt-16 pb-5" style={{ width: '82%' }}>
        <p className={`${SECTION_TITLE} mb-2`} style={{ color: '#D99962' }}>
          Лобби турнира
        </p>

        <EditableText
          value={tournament.title}
          onSave={(v) => onPatch({ title: v.toUpperCase() })}
          maxLength={40}
          placeholder="Название турнира"
          className="mb-2"
          pencilSize={16}
          renderValue={(v) => (
            <h1
              className="text-2xl font-black text-white uppercase leading-tight"
              style={{ letterSpacing: '0.04em' }}
            >
              {v || 'Без названия'}
            </h1>
          )}
        />

        <div className="space-y-1.5">
          <EditableText
            value={tournament.startDate}
            onSave={(v) => onPatch({ startDate: v })}
            type="date"
            renderValue={(v) => (
              <span
                className="flex items-center gap-2 text-[12px]"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                <Calendar size={12} style={{ color: '#c8a38e' }} />
                <span className="capitalize">{formatDate(v)}</span>
              </span>
            )}
          />

          <EditableText
            value={tournament.startTime}
            onSave={(v) => onPatch({ startTime: v })}
            type="time"
            renderValue={(v) => (
              <span
                className="flex items-center gap-2 text-[12px]"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                <Clock size={12} style={{ color: '#c8a38e' }} />
                {v}
              </span>
            )}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Participants editor ───────────────────────────────────────────────── */
function ParticipantsEditor({
  participants,
  totalSeats,
  canAdd,
  onAdd,
  onRemove,
}: {
  participants: Participant[];
  totalSeats: number;
  canAdd: boolean;
  onAdd: (nickname: string) => void;
  onRemove: (id: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const takenNicknames = new Set(participants.map((p) => p.nickname));
  const available = mockUsers.filter((u) => !takenNicknames.has(u.nickname));
  const ranked = sortByRating(
    participants.map((p) => ({ ...p, rating: resolveSeasonRating(p.nickname) })),
  );

  return (
    <div className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <h3 className={SECTION_TITLE} style={{ color: '#F2D8A7' }}>
          Участники ({participants.length}/{totalSeats})
        </h3>
        <span className="text-[12px] font-600" style={{ color: '#D99962' }}>
          Рейтинг сезона
        </span>
      </div>

      {ranked.length === 0 ? (
        <p className="px-5 py-4 text-[13px] font-500" style={{ color: '#6B6360' }}>
          Участники не добавлены
        </p>
      ) : (
        <div>
          {ranked.map((p, idx) => {
            const isFinalTable = idx < 9;

            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-5 py-3"
                style={{
                  borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <span
                  className="text-[11px] font-700 w-5 text-right shrink-0"
                  style={{ color: isFinalTable ? '#D99962' : '#ffffff' }}
                >
                  {idx + 1}
                </span>

                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-700 shrink-0"
                  style={{
                    background: isFinalTable ? 'rgba(140,76,39,0.28)' : 'rgba(255,255,255,0.08)',
                    color: isFinalTable ? '#c8a38e' : '#A39B98',
                  }}
                >
                  {p.nickname[0].toUpperCase()}
                </div>

                <p className="flex-1 min-w-0 text-[13px] font-600 truncate text-white">
                  {p.nickname}
                </p>

                <span
                  className="text-[12px] font-700 block text-right min-w-[52px] shrink-0"
                  style={{ color: isFinalTable ? '#D99962' : '#ffffff' }}
                >
                  {p.rating.toLocaleString('ru-RU')}
                </span>

                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  aria-label={`Удалить ${p.nickname}`}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center active:scale-95 transition-transform"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.35)',
                  }}
                >
                  <X size={13} strokeWidth={2.6} style={{ color: '#f87171' }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add participant — finished tournaments only */}
      {canAdd && (
        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-700 active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(to right, #2A211D, #463129)',
              border: '1px solid rgba(217,153,98,0.35)',
              color: '#D99962',
            }}
          >
            <UserPlus size={16} strokeWidth={2.2} />
            Добавить участника
          </button>

          <AnimatePresence initial={false}>
            {pickerOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-2">
                  {available.length === 0 ? (
                    <p className="text-[12px] font-500 py-2" style={{ color: '#6B6360' }}>
                      Все пользователи уже добавлены
                    </p>
                  ) : (
                    available.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          onAdd(user.nickname);
                          setPickerOpen(false);
                        }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl active:scale-[0.98] transition-transform"
                        style={{ background: '#231A16', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="min-w-0 text-left">
                          <p className="text-[13px] font-700 text-white truncate">{user.nickname}</p>
                          <p className="text-[11px] font-500 truncate" style={{ color: '#8c8c88' }}>
                            {user.email}
                          </p>
                        </div>
                        <Plus size={16} strokeWidth={2.4} style={{ color: '#D99962' }} />
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ── Editor body ────────────────────────────────────────────────────────── */
function Editor({ tournament }: { tournament: Tournament }) {
  const navigate = useNavigate();
  const { updateTournament, deleteTournament, addTournament } = useTournaments();

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFinished = hasFinished(tournament);
  const occupiedSeats = tournament.participants.length;

  // Revoke the temporary object URL when it is replaced or the editor unmounts
  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const patch = (p: Partial<Tournament>) => updateTournament(tournament.id, p);

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  };

  const addParticipant = (nickname: string) => {
    patch({
      participants: [
        ...tournament.participants,
        { id: `p-${Date.now()}`, nickname, rating: resolveSeasonRating(nickname) },
      ],
    });
  };

  const removeParticipant = (id: string) => {
    patch({ participants: tournament.participants.filter((p) => p.id !== id) });
  };

  const handleDelete = () => {
    if (!window.confirm('Точно удалить?')) return;
    deleteTournament(tournament.id);
    navigate('/admin/tournaments');
  };

  const handleCopy = () => {
    const { id: _id, ...rest } = tournament;
    const newId = addTournament({
      ...rest,
      title: `${tournament.title} Copy`,
      participants: tournament.participants.map((p) => ({ ...p, id: `p-${Date.now()}-${p.id}` })),
      features: [...tournament.features],
    });
    navigate(`/admin/tournaments/${newId}`);
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <button
        type="button"
        onClick={() => navigate('/admin/tournaments')}
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e.target.files?.[0])}
      />

      <div
        className="flex-1 scrollable"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <EditableHero
          tournament={tournament}
          photoOverride={photoPreview}
          onPatch={patch}
          onPickPhoto={() => fileInputRef.current?.click()}
        />

        <div className="px-5 pt-4 space-y-5">
          {/* Seats — occupied is always derived from the participant list */}
          <div className="rounded-2xl p-4 space-y-3" style={CARD_STYLE}>
            <h3 className={SECTION_TITLE} style={{ color: '#F2D8A7' }}>
              Места
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[11px] font-600 mb-1" style={{ color: '#A39B98' }}>
                  Всего
                </p>
                <EditableText
                  value={String(tournament.totalSeats)}
                  onSave={(v) => patch({ totalSeats: Number(v) || tournament.totalSeats })}
                  type="number"
                  renderValue={(v) => (
                    <span className="text-white font-800 text-[18px]">{v}</span>
                  )}
                />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-600 mb-1" style={{ color: '#A39B98' }}>
                  Занято
                </p>
                <span className="text-white font-800 text-[18px]">{occupiedSeats}</span>
                <p className="text-[10px] font-500 mt-0.5" style={{ color: '#6B6360' }}>
                  по списку участников
                </p>
              </div>
            </div>
          </div>

          {/* Guarantee */}
          <div className="relative rounded-2xl overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{ background: 'linear-gradient(to right, #D99962, #F2D8A7)' }}
            />
            <div
              className="relative flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{ border: '1px solid rgba(242,216,167,0.32)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(to right, #D99962, #F2D8A7)' }}
              >
                <Star size={20} fill="currentColor" style={{ color: '#0A0908' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[11px] font-600 uppercase tracking-[0.12em] mb-0.5"
                  style={{ color: '#A39B98' }}
                >
                  Гарантия очков
                </p>
                <EditableText
                  value={String(tournament.guarantee)}
                  onSave={(v) => patch({ guarantee: Number(v) || 0 })}
                  type="number"
                  renderValue={(v) => (
                    <span className="text-white font-900 text-[24px] tracking-wide leading-tight">
                      {Number(v).toLocaleString('ru-RU')}
                    </span>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="rounded-2xl p-5 space-y-5" style={CARD_STYLE}>
            <section>
              <h3 className={`${SECTION_TITLE} mb-3`} style={{ color: '#F2D8A7' }}>
                О турнире
              </h3>
              <EditableText
                value={tournament.about}
                onSave={(v) => patch({ about: v })}
                multiline
                rows={6}
                placeholder="Расскажите об этом турнире"
                renderValue={(v) => (
                  <p
                    className="text-[13px] font-400 leading-relaxed"
                    style={{ color: v ? '#A39B98' : '#6B6360' }}
                  >
                    {v || 'Описание не заполнено'}
                  </p>
                )}
              />
            </section>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            <section>
              <h3 className={`${SECTION_TITLE} mb-3`} style={{ color: '#F2D8A7' }}>
                Особенности (пунктами)
              </h3>
              <FeatureListEditor
                features={tournament.features}
                onChange={(features) => patch({ features })}
              />
            </section>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            <section>
              <h3 className={`${SECTION_TITLE} mb-3`} style={{ color: '#F2D8A7' }}>
                Адрес
              </h3>
              <EditableText
                value={tournament.address}
                onSave={(v) => patch({ address: v })}
                placeholder="Адрес проведения"
                renderValue={(v) => (
                  <p className="text-[13px] font-400" style={{ color: '#A39B98' }}>
                    {v || 'Адрес не указан'}
                  </p>
                )}
              />
            </section>
          </div>

          <ParticipantsEditor
            participants={tournament.participants}
            totalSeats={tournament.totalSeats}
            canAdd={isFinished}
            onAdd={addParticipant}
            onRemove={removeParticipant}
          />

          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-700 text-white bg-[#463129] active:scale-[0.98] transition-transform"
            style={{ border: '1px solid #D99962' }}
          >
            Скопировать турнир
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-700 text-white bg-red-900/80 active:scale-[0.98] transition-transform"
            style={{ border: '1px solid rgba(239,68,68,0.45)' }}
          >
            <Trash2 size={17} strokeWidth={2.3} />
            Удалить турнир
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminTournamentEditor() {
  const { id } = useParams<{ id: string }>();
  const { tournaments } = useTournaments();

  const tournament = tournaments.find((t) => t.id === id);
  if (!tournament) return <Navigate to="/admin/tournaments" replace />;

  return <Editor tournament={tournament} />;
}
