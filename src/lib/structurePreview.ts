import {
  breakComment,
  formatBlinds,
  isBreakLevel,
  type BlindLevel,
  type BlindStructure,
} from '../data/blindStructures';

export type StructurePreviewRow = {
  key: string;
  label: string;
  detail: string;
  minutes: string;
  break: boolean;
  lateRegEnd: boolean;
};

export function structurePreviewRows(
  structure: Pick<BlindStructure, 'levels'> | null | undefined,
): StructurePreviewRow[] {
  if (!structure) return [];
  return structure.levels.map((level, index) => previewRow(level, index));
}

function previewRow(level: BlindLevel, index: number): StructurePreviewRow {
  const minutes = `${Math.max(0, level.durationMinutes)} мин`;
  if (isBreakLevel(level)) {
    const note = breakComment(level);
    const lateRegEnd = level.isLateRegEnd === true;
    const detail = [note, lateRegEnd ? 'конец реги' : ''].filter(Boolean).join(' · ');
    return {
      key: `break-${index}`,
      label: 'Перерыв',
      detail,
      minutes,
      break: true,
      lateRegEnd,
    };
  }
  return {
    key: `level-${index}`,
    label: String(level.level || index + 1),
    detail: formatBlinds(level),
    minutes,
    break: false,
    lateRegEnd: false,
  };
}
