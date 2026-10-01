import { useEffect, useState } from 'react';
import {
  featuresWithStackDraft,
  parseStackAmount,
  stackDraftFromFeatures,
  type StackDraft,
} from '../../lib/stackFeatures';

interface Props {
  features: string[];
  fallbackStart: number;
  addonAvailable: boolean;
  onChange: (features: string[]) => void;
}

function grouped(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function StackNumberInput({
  label,
  committed,
  placeholder,
  allowEmpty,
  onCommit,
}: {
  label: string;
  committed: number | null;
  placeholder: string;
  allowEmpty: boolean;
  onCommit: (value: number | null) => void;
}) {
  const [text, setText] = useState(committed === null ? '' : grouped(committed));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(committed === null ? '' : grouped(committed));
  }, [committed, focused]);

  const commit = (raw: string) => {
    if (!raw.trim()) {
      if (allowEmpty) onCommit(null);
      else window.alert('Укажите стартовый стек числом, от 1000 фишек');
      setText(committed === null ? '' : grouped(committed));
      return;
    }
    const amount = parseStackAmount(raw);
    if (amount === null) {
      window.alert('Число стека — от 1000 фишек');
      setText(committed === null ? '' : grouped(committed));
      return;
    }
    onCommit(amount);
    setText(grouped(amount));
  };

  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-700 uppercase tracking-[0.14em]" style={{ color: '#8c8c88' }}>
        {label}
      </span>
      <input
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit(text);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const amount = parseStackAmount(next);
          if (amount !== null) onCommit(amount);
          else if (!next.trim() && allowEmpty) onCommit(null);
        }}
        className="w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 text-[14px] outline-none"
      />
    </label>
  );
}

export function StackFeatureFields({ features, fallbackStart, addonAvailable, onChange }: Props) {
  const draft = stackDraftFromFeatures(features, fallbackStart);
  const addonOn = addonAvailable || draft.addon !== null;

  const write = (patch: Partial<StackDraft>) => {
    onChange(featuresWithStackDraft(features, { ...draft, ...patch }));
  };

  return (
    <div className="space-y-3">
      <StackNumberInput
        label="Стартовый стек"
        committed={draft.starting}
        placeholder="Обязательное число"
        allowEmpty={false}
        onCommit={(starting) => {
          if (starting === null || starting === draft.starting) return;
          write({ starting });
        }}
      />
      <StackNumberInput
        label="Стек ребая"
        committed={draft.rebuy}
        placeholder="Пусто — столько же, сколько вход"
        allowEmpty
        onCommit={(rebuy) => {
          if (rebuy === draft.rebuy) return;
          write({ rebuy });
        }}
      />
      {addonOn ? (
        <StackNumberInput
          label="Стек аддона"
          committed={draft.addon}
          placeholder="Число фишек"
          allowEmpty
          onCommit={(addon) => {
            if (addon === draft.addon) return;
            write({ addon });
          }}
        />
      ) : null}
    </div>
  );
}
