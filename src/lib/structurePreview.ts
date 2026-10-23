import {
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

/** Clock when the late-registration level starts, from the tournament start time. */
export function lateRegEndClock(startTime: string, levels: readonly BlindLevel[] | undefined): string | null {
  const match = startTime.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match || !levels) return null;
  let minutes = Number(match[1]) * 60 + Number(match[2]);
  if (!Number.isFinite(minutes)) return null;
  for (const level of levels) {
    if (level.isLateRegEnd === true) {
      const hour = Math.floor(minutes / 60) % 24;
      const minute = minutes % 60;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    minutes += Math.max(0, level.durationMinutes);
  }
  return null;
}

function previewRow(level: BlindLevel, index: number): StructurePreviewRow {
  const minutes = `${Math.max(0, level.durationMinutes)} мин`;
  if (isBreakLevel(level)) {
    const lateRegEnd = level.isLateRegEnd === true;
    return {
      key: `break-${index}`,
      label: 'Перерыв',
      detail: lateRegEnd ? 'Конец поздней регистрации' : '',
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
