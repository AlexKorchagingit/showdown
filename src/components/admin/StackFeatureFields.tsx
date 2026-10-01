import { featuresWithStackDraft, stackDraftFromFeatures } from '../../lib/stackFeatures';

interface Props {
  features: string[];
  fallbackStart: number;
  addonAvailable: boolean;
  onChange: (features: string[]) => void;
}

function parseInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const value = Number(digits);
  return Number.isInteger(value) && value >= 1000 ? value : null;
}

export function StackFeatureFields({ features, fallbackStart, addonAvailable, onChange }: Props) {
  const draft = stackDraftFromFeatures(features, fallbackStart);
  const addonOn = addonAvailable || draft.addon !== null;

  const write = (next: { starting: number | null; rebuy: number | null; addon: number | null }) => {
    onChange(featuresWithStackDraft(features, next));
  };

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-[11px] font-700 uppercase tracking-[0.14em]" style={{ color: '#8c8c88' }}>
          Стартовый стек
        </span>
        <input
          inputMode="numeric"
          value={draft.starting ? draft.starting.toLocaleString('ru-RU') : ''}
          placeholder="Обязательное число"
          onChange={(event) => {
            const starting = parseInput(event.target.value);
            write({ starting, rebuy: draft.rebuy, addon: draft.addon });
          }}
          onBlur={() => {
            if (!draft.starting) window.alert('Укажите стартовый стек числом, от 1000 фишек');
          }}
          className="w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 text-[14px] outline-none"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-700 uppercase tracking-[0.14em]" style={{ color: '#8c8c88' }}>
          Стек ребая
        </span>
        <input
          inputMode="numeric"
          value={draft.rebuy ? draft.rebuy.toLocaleString('ru-RU') : ''}
          placeholder="Пусто — столько же, сколько вход"
          onChange={(event) => {
            write({
              starting: draft.starting,
              rebuy: parseInput(event.target.value),
              addon: draft.addon,
            });
          }}
          className="w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 text-[14px] outline-none"
        />
      </label>
      {addonOn ? (
        <label className="block space-y-1">
          <span className="text-[11px] font-700 uppercase tracking-[0.14em]" style={{ color: '#8c8c88' }}>
            Стек аддона
          </span>
          <input
            inputMode="numeric"
            value={draft.addon ? draft.addon.toLocaleString('ru-RU') : ''}
            placeholder="Число фишек"
            onChange={(event) => {
              write({
                starting: draft.starting,
                rebuy: draft.rebuy,
                addon: parseInput(event.target.value),
              });
            }}
            className="w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 text-[14px] outline-none"
          />
        </label>
      ) : null}
    </div>
  );
}
