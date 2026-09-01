import {
  breakComment,
  isBreakLevel,
  structureDurationLabel,
  type BlindLevel,
  type BlindStructure,
} from '../data/blindStructures';
import type { Tournament } from '../types/tournament';
import { formatIsoDay } from './financePeriod';
import { tournamentsUsingStructure } from './timerTournament';

export type ExcelCell = string | number | null;
export type ExcelSheet = {
  name: string;
  rows: ExcelCell[][];
};

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function excelSheetName(raw: string, used: Set<string>): string {
  const cleaned = raw
    .replace(/[\\/?*[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let base = (cleaned || 'Структура').slice(0, 31);
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n})`;
    name = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function uniqueFeatures(tournaments: Tournament[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tournament of tournaments) {
    for (const item of tournament.features ?? []) {
      const text = item.trim().replace(/\s+/g, ' ');
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
  }
  return out;
}

function uniqueNumbers(values: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const value of values) {
    if (!Number.isFinite(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function formatMinutesTotal(total: number): string {
  const minutes = Math.max(0, Math.round(total));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} мин`;
  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}

export function lateRegExportLabel(levels: BlindLevel[]): string {
  const index = levels.findIndex((level) => level.isLateRegEnd === true);
  if (index < 0) return 'не задано';
  const level = levels[index]!;
  if (isBreakLevel(level)) {
    const previous = levels.slice(0, index).reverse().find((row) => !isBreakLevel(row));
    return previous ? `перерыв после уровня ${previous.level}` : 'перерыв';
  }
  return `уровень ${level.level}`;
}

function formatBlindsPair(level: BlindLevel): string {
  return `${level.smallBlind.toLocaleString('ru-RU')}/${level.bigBlind.toLocaleString('ru-RU')}`;
}

function levelTypeLabel(level: BlindLevel): string {
  if (!isBreakLevel(level)) return 'Уровень';
  return level.isLateRegEnd ? 'Перерыв (конец реги)' : 'Перерыв';
}

function kv(label: string, value: ExcelCell): ExcelCell[] {
  return [label, value];
}

export function buildBlindStructureSheetRows(
  structure: BlindStructure,
  tournaments: Tournament[],
): ExcelCell[][] {
  const linked = tournamentsUsingStructure(tournaments, structure);
  const features = uniqueFeatures(linked);
  const playing = structure.levels.filter((level) => !isBreakLevel(level));
  const breaks = structure.levels.filter((level) => isBreakLevel(level));
  const totalMinutes = structure.levels.reduce((sum, level) => sum + Math.max(0, level.durationMinutes), 0);
  const stacks = uniqueNumbers(linked.map((row) => row.stackSize));
  const bounty = linked.some((row) => row.isBounty === true);
  const lateUntil = [
    ...new Set(linked.map((row) => row.lateRegUntil.trim()).filter(Boolean)),
  ];

  const rows: ExcelCell[][] = [
    kv('Название структуры', structure.name),
    kv('Название турнира', linked.map((row) => row.title.trim()).filter(Boolean).join(', ') || structure.name),
    kv('Гарантия очков', structure.guarantee),
    kv('Длительность уровня по умолчанию', `${structure.levelDuration} мин`),
    kv('Длительности уровней', structureDurationLabel(structure)),
    kv('Игровых уровней', playing.length),
    kv('Перерывов', breaks.length),
    kv('Общая длительность', formatMinutesTotal(totalMinutes)),
    kv('Закрытие поздней регистрации', lateRegExportLabel(structure.levels)),
    kv('Поздняя регистрация до', lateUntil.join(', ') || '—'),
    kv('Стартовый стек', stacks.length > 0 ? stacks.map((n) => n.toLocaleString('ru-RU')).join(', ') : '—'),
    kv('Bounty', linked.length === 0 ? '—' : bounty ? 'Да' : 'Нет'),
    [],
    ['Особенности турнира'],
  ];

  if (features.length === 0) {
    rows.push(['—']);
  } else {
    for (const feature of features) rows.push([feature]);
  }

  rows.push(
    [],
    ['Тип', '№', 'Блайнды', 'Анте', 'Минуты', 'Закрытие реги', 'Комментарий'],
  );

  for (const level of structure.levels) {
    const breakRow = isBreakLevel(level);
    rows.push([
      levelTypeLabel(level),
      breakRow ? '—' : level.level,
      breakRow ? '—' : formatBlindsPair(level),
      breakRow ? '—' : level.ante,
      level.durationMinutes,
      level.isLateRegEnd ? 'Да' : '',
      breakRow ? breakComment(level) : (level.comment?.trim() ?? ''),
    ]);
  }

  if (structure.payouts.length > 0) {
    rows.push([], ['Призовые места (структура)'], ['Место', 'Доля, %']);
    for (const place of structure.payouts) {
      rows.push([place.place, place.share]);
    }
  }

  return rows;
}

export function buildBlindStructureExportSheets(
  structures: BlindStructure[],
  tournaments: Tournament[],
): ExcelSheet[] {
  const used = new Set<string>();
  return structures.map((structure) => ({
    name: excelSheetName(structure.name, used),
    rows: buildBlindStructureSheetRows(structure, tournaments),
  }));
}

function cellXml(value: ExcelCell): string {
  if (value == null || value === '') return '<Cell/>';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(String(value))}</Data></Cell>`;
}

export function blindStructuresWorkbookXml(sheets: ExcelSheet[]): string {
  const worksheets = sheets
    .map((sheet) => {
      const tableRows = sheet.rows
        .map((row) => `<Row>${row.map(cellXml).join('')}</Row>`)
        .join('');
      return `<Worksheet ss:Name="${xmlEscape(sheet.name)}"><Table>${tableRows}</Table></Worksheet>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheets}</Workbook>`;
}

export function blindStructuresExportFilename(now = new Date()): string {
  return `showdown-blinds-${formatIsoDay(now)}.xls`;
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Multi-sheet Excel workbook (SpreadsheetML) — one worksheet per blind structure. */
export function exportBlindStructuresToExcel(
  structures: BlindStructure[],
  tournaments: Tournament[],
  filename = blindStructuresExportFilename(),
) {
  if (structures.length === 0) return;
  const xml = blindStructuresWorkbookXml(buildBlindStructureExportSheets(structures, tournaments));
  const blob = new Blob([`\uFEFF${xml}`], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerDownload(filename, blob);
}
