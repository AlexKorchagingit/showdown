import { useMemo, useState } from 'react';
import { CompactHeader } from '../CompactHeader';
import { TournamentCard } from '../TournamentCard';
import { useTournaments } from '../../context/TournamentContext';
import { useFinance } from '../../context/FinanceContext';
import { useBlinds } from '../../context/BlindsContext';
import { compareByStart, isFinished, isHidden } from '../../lib/tournamentStatus';
import {
  busiestNight,
  overlayPreview,
  overlaySampleHeads,
  overlaySeriesLabel,
  overlaySeriesKey,
  seriesAverages,
  type OverlayNight,
} from '../../lib/overlayPlan';
import type { Tournament } from '../../types/tournament';

const FIELD_CLASS =
  'w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 text-[16px] font-800 outline-none focus:border-[#D99962]/70';

function parseCount(raw: string): number {
  const value = Math.round(Number(raw.replace(',', '.')));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function nightLine(people: number, rebuys: number, addons: number): string {
  return `${people} чел · ${rebuys} реб. · ${addons} адд.`;
}

export function OverlayPlanner({ onClose }: { onClose: () => void }) {
  const { tournaments } = useTournaments();
  const { isRunning, linkedTournamentId } = useBlinds();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tournaments.find((row) => row.id === selectedId) ?? null;

  const sorted = [...tournaments].sort((a, b) => {
    const aFinished = isFinished(a);
    if (aFinished !== isFinished(b)) return aFinished ? 1 : -1;
    return aFinished ? compareByStart(b, a) : compareByStart(a, b);
  });

  return (
    <div className="absolute inset-0 z-[70] flex flex-col bg-[#110b09]">
      <CompactHeader title="Оверлей" onBack={selected ? () => setSelectedId(null) : onClose} />
      <div
        className="flex-1 scrollable px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        {selected ? (
          <OverlayEditor key={selected.id} tournament={selected} />
        ) : sorted.length === 0 ? (
          <p className="text-center text-[13px] pt-10" style={{ color: '#6B6360' }}>
            Турниров пока нет
          </p>
        ) : (
          <div className="space-y-3">
            {sorted.map((tournament) => (
              <div
                key={tournament.id}
                className={
                  isHidden(tournament) ? 'opacity-45' : isFinished(tournament) ? 'opacity-55' : ''
                }
              >
                <TournamentCard
                  tournament={tournament}
                  timerRunning={isRunning && linkedTournamentId === tournament.id}
                  onClick={(row) => setSelectedId(row.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OverlayEditor({ tournament }: { tournament: Tournament }) {
  const { tournaments, saveTournamentOverlay } = useTournaments();
  const { transactions, isLoading } = useFinance();
  const averages = useMemo(
    () => seriesAverages(tournament, tournaments, transactions),
    [tournament, tournaments, transactions],
  );
  const record = useMemo(
    () => busiestNight(tournament, tournaments, transactions),
    [tournament, tournaments, transactions],
  );
  const [baseText, setBaseText] = useState(String(tournament.overlayBase ?? tournament.guarantee));
  const [headText, setHeadText] = useState(
    tournament.overlayPerHead == null ? '100' : String(tournament.overlayPerHead),
  );
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState('');

  const base = parseCount(baseText);
  const perHead = parseCount(headText);
  const norm = averages.nights > 0 ? Math.round(averages.people) : 17;
  const averageNight: OverlayNight = {
    label: 'Средний вечер',
    people: averages.nights > 0 ? Math.round(averages.people) : norm,
    rebuys: Math.round(averages.rebuys),
    addons: Math.round(averages.addons),
  };
  const nights = record ? [averageNight, record] : [averageNight];
  const samples = overlaySampleHeads(perHead);
  const seriesName = overlaySeriesLabel(overlaySeriesKey(tournament.title), tournament.title);

  const save = async () => {
    setSaving(true);
    setSavedNote('');
    const ok = await saveTournamentOverlay(tournament.id, base, perHead);
    setSaving(false);
    if (ok) setSavedNote('Сохранено');
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-700 uppercase tracking-[0.16em]" style={{ color: '#D99962' }}>
          {seriesName}
        </p>
        <h2 className="text-[18px] font-800 text-white leading-tight">{tournament.title}</h2>
      </div>

      <div
        className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed"
        style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {averages.nights > 0 ? (
          <>
            В среднем на {seriesName}: <b className="text-white">{Math.round(averages.people)} человек</b>,{' '}
            <b className="text-white">{averages.rebuys.toFixed(1).replace('.', ',')} ребая</b>,{' '}
            <b className="text-white">{averages.addons.toFixed(1).replace('.', ',')} аддона</b>
            <span style={{ color: '#8c8c88' }}> · {averages.nights} закрытых</span>
          </>
        ) : (
          <>По этой серии ещё нет закрытых турниров. В таблице норма пока {norm} человек.</>
        )}
        {isLoading ? <span style={{ color: '#8c8c88' }}> Считаю ребаи…</span> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="block text-[11px] font-700 uppercase tracking-[0.14em] mb-2" style={{ color: '#D99962' }}>
            Начальная гарантия
          </span>
          <input
            inputMode="numeric"
            value={baseText}
            onChange={(event) => {
              setSavedNote('');
              setBaseText(event.target.value.replace(/[^\d]/g, ''));
            }}
            className={FIELD_CLASS}
          />
        </label>
        <label>
          <span className="block text-[11px] font-700 uppercase tracking-[0.14em] mb-2" style={{ color: '#D99962' }}>
            Оверлей за человека
          </span>
          <input
            inputMode="numeric"
            value={headText}
            onChange={(event) => {
              setSavedNote('');
              setHeadText(event.target.value.replace(/[^\d]/g, ''));
            }}
            className={FIELD_CLASS}
          />
        </label>
      </div>
      <p className="text-[12px] leading-relaxed" style={{ color: '#A39B98' }}>
        Пока людей не больше среднего, гарантия равна начальной. Каждый следующий человек добавляет оверлей целиком,
        ребай — половину ({Math.round(perHead / 2)}), аддон — четверть ({Math.round(perHead / 4)}).
      </p>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="w-full py-3 rounded-xl text-[14px] font-800 text-[#0A0908] active:scale-[0.98] disabled:opacity-50"
        style={{ background: 'linear-gradient(to right, #8C4C27, #D99962)' }}
      >
        {saving ? 'Сохраняю…' : 'Запомнить цифры'}
      </button>
      {savedNote ? <p className="text-[12px] font-700" style={{ color: '#86efac' }}>{savedNote}</p> : null}
      {tournament.isClosed ? (
        <p className="text-[12px] leading-relaxed" style={{ color: '#8c8c88' }}>
          Турнир уже закрыт: места и начисленные очки эта форма не трогает. Таблица ниже только показывает, как гарантия вела бы себя при таких цифрах.
        </p>
      ) : null}

      <div className="space-y-3">
        {samples.map((sample) => {
          const active = sample === perHead;
          return (
            <section
              key={sample}
              className="rounded-2xl overflow-hidden"
              style={{
                background: '#2A211D',
                border: active ? '1px solid rgba(217,153,98,0.7)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <p className="px-4 py-2 text-[13px] font-800" style={{ color: active ? '#F2D8A7' : '#ffffff' }}>
                Оверлей {sample.toLocaleString('ru-RU')}
                {active ? ' · сейчас в поле' : ''}
              </p>
              {nights.map((night) => {
                const row = overlayPreview({
                  base,
                  perHead: sample,
                  normPeople: norm,
                  people: night.people,
                  rebuys: night.rebuys,
                  addons: night.addons,
                });
                return (
                  <div
                    key={night.label}
                    className="px-4 py-2"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <p className="text-[12px] font-700" style={{ color: '#D99962' }}>
                      {night.label}
                    </p>
                    <p className="text-[11px]" style={{ color: '#8c8c88' }}>{nightLine(night.people, night.rebuys, night.addons)}</p>
                    <p className="text-[13px] font-700 text-white mt-1">
                      Гарантия {row.guarantee.toLocaleString('ru-RU')}
                      {' · '}1-е {row.first.toLocaleString('ru-RU')}
                      {' · '}призовых {row.itm}
                    </p>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
