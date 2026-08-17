interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function BountyCheckbox({ checked, onChange, className = '' }: Props) {
  return (
    <label
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 rounded border-[#D99962]/60 bg-[#231A16] accent-[#D99962] cursor-pointer"
      />
      <span className="text-[13px] font-700 text-white">Нокаут турнир (Bounty)</span>
    </label>
  );
}
