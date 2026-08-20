import { useBlinds } from '../../context/BlindsContext';

const FIELD_CLASS =
  'w-full bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#D99962]/60 transition-colors';
const LABEL_CLASS =
  'block text-[10px] font-700 uppercase tracking-[0.16em] mb-1 text-[#D99962]';

export function BlindStructurePicker({
  structureId,
  structureName,
  onChange,
}: {
  structureId?: string;
  structureName?: string;
  onChange: (next: { blindStructureId: string; blindStructure: string }) => void;
}) {
  const { structures } = useBlinds();
  const selectedId =
    structureId ??
    structures.find((row) => row.name === (structureName ?? '').trim())?.id ??
    structures[0]?.id ??
    '';

  if (structures.length === 0) return null;

  return (
    <label className="block">
      <span className={LABEL_CLASS}>Структура блайндов</span>
      <select
        value={selectedId}
        onChange={(event) => {
          const next = structures.find((row) => row.id === event.target.value);
          if (!next) return;
          onChange({ blindStructureId: next.id, blindStructure: next.name });
        }}
        className={FIELD_CLASS}
      >
        {structures.map((structure) => (
          <option key={structure.id} value={structure.id}>
            {structure.name}
          </option>
        ))}
      </select>
    </label>
  );
}
