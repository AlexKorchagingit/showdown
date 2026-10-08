import type { BlindStructure } from '../data/blindStructures';
import type { Tournament } from '../types/tournament';
import { tournamentsUsingStructure } from './timerTournament';

export type StructureDeleteBlock =
  | { kind: 'last' }
  | { kind: 'running' }
  | { kind: 'in-use'; titles: string[] };

/** Why a structure cannot be deleted right now, or null when it is safe to remove. */
export function structureDeleteBlock(
  structure: BlindStructure,
  structures: BlindStructure[],
  tournaments: Tournament[],
  timer: { isRunning: boolean; activeStructureId: string | null },
): StructureDeleteBlock | null {
  if (structures.length <= 1) return { kind: 'last' };
  if (timer.isRunning && timer.activeStructureId === structure.id) return { kind: 'running' };
  // Closed events keep the structure name as history. Open ones still need the ladder.
  const open = tournamentsUsingStructure(tournaments, structure).filter(
    (tournament) => tournament.isClosed !== true,
  );
  if (open.length > 0) {
    return {
      kind: 'in-use',
      titles: open.map((tournament) => `${tournament.title} · ${tournament.startDate.slice(0, 10)}`),
    };
  }
  return null;
}

export function structureDeleteBlockMessage(block: StructureDeleteBlock, name: string): string {
  if (block.kind === 'last') {
    return 'Это последняя структура. Сначала создайте другую, потом удаляйте эту.';
  }
  if (block.kind === 'running') {
    return `Таймер идёт на структуре «${name}». Остановите его и повторите.`;
  }
  const shown = block.titles.slice(0, 5).join('\n');
  const more = block.titles.length > 5 ? `\nи ещё ${block.titles.length - 5}` : '';
  return (
    `Структура «${name}» стоит у незакрытых турниров:\n${shown}${more}\n\n` +
    'Назначьте им другую структуру и повторите, иначе у них пропадёт сетка блайндов.'
  );
}

export function structureDeleteConfirm(name: string): string {
  return (
    `Удалить структуру «${name}»?\n\n` +
    'Закрытые турниры сохранят её название. Вернуть структуру после удаления нельзя.'
  );
}
