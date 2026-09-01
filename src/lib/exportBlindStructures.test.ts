import { describe, expect, it } from 'vitest';
import {
  BLIND_STRUCTURES,
  type BlindLevel,
  type BlindStructure,
} from '../data/blindStructures';
import type { Tournament } from '../types/tournament';
import {
  blindStructuresWorkbookXml,
  buildBlindStructureExportSheets,
  buildBlindStructureSheetRows,
  excelSheetName,
  lateRegExportLabel,
} from './exportBlindStructures';

function playing(level: number): BlindLevel {
  return {
    level,
    smallBlind: 100 * level,
    bigBlind: 200 * level,
    ante: 200 * level,
    durationMinutes: 20,
  };
}

function pause(lateReg = false, comment?: string): BlindLevel {
  return {
    level: 0,
    smallBlind: 200,
    bigBlind: 400,
    ante: 400,
    durationMinutes: 15,
    isBreak: true,
    ...(lateReg ? { isLateRegEnd: true } : {}),
    ...(comment ? { comment } : {}),
  };
}

function structure(name: string, levels: BlindLevel[]): BlindStructure {
  return {
    id: `bs-${name}`,
    name,
    levelDuration: 20,
    guarantee: 12000,
    levels,
    payouts: [
      { place: 1, share: 50 },
      { place: 2, share: 30 },
    ],
  };
}

function event(title: string, structureName: string, features: string[]): Tournament {
  return {
    id: title,
    title,
    imageUrl: '',
    address: '',
    startDate: '2026-09-01',
    startTime: '19:00',
    totalSeats: 27,
    guarantee: 12000,
    about: '',
    features,
    participants: [],
    lateRegUntil: '21:10',
    blindStructure: structureName,
    blindStructureId: `bs-${structureName}`,
    stackSize: 30000,
    levelDuration: '20 мин',
    isClosed: false,
    isBounty: false,
  };
}

describe('blind structure Excel export', () => {
  it('sanitizes sheet names and keeps them unique', () => {
    const used = new Set<string>();
    expect(excelSheetName('Grand/Opening?*', used)).toBe('Grand Opening');
    expect(excelSheetName('Grand Opening', used)).toBe('Grand Opening (2)');
  });

  it('describes late-reg close on a break after a playing level', () => {
    expect(lateRegExportLabel([playing(1), playing(2), pause(true), playing(3)])).toBe(
      'перерыв после уровня 2',
    );
    expect(lateRegExportLabel([playing(1), playing(2)])).toBe('не задано');
  });

  it('puts tournament features at the top and one sheet per structure', () => {
    const ladder = structure('Freeroll', [playing(1), pause(true, 'Цвет-ап'), playing(2)]);
    const sheets = buildBlindStructureExportSheets(
      [ladder, structure('Phoenix', [playing(1)])],
      [event('Freeroll', 'Freeroll', ['Вход БЕСПЛАТНЫЙ', 'Есть возможность взять аддон'])],
    );
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Freeroll', 'Phoenix']);
    const text = sheets[0]!.rows.flat().map(String).join('\n');
    expect(text).toContain('Особенности турнира');
    expect(text).toContain('Вход БЕСПЛАТНЫЙ');
    expect(text).toContain('Есть возможность взять аддон');
    expect(text).toContain('Перерыв (конец реги)');
    expect(text).toContain('Цвет-ап');
    expect(text).toContain('100/200');
  });

  it('builds SpreadsheetML with a worksheet per structure', () => {
    const xml = blindStructuresWorkbookXml(
      buildBlindStructureExportSheets(BLIND_STRUCTURES.slice(0, 2), []),
    );
    expect(xml).toContain('<Worksheet ss:Name="Grand Opening">');
    expect(xml).toContain('<Worksheet ss:Name="Freeroll">');
    expect(xml).toContain('ss:Type="Number"');
  });

  it('falls back to a dash when no tournament features are linked', () => {
    const rows = buildBlindStructureSheetRows(structure('Custom', [playing(1)]), []);
    const featuresIndex = rows.findIndex((row) => row[0] === 'Особенности турнира');
    expect(rows[featuresIndex + 1]?.[0]).toBe('—');
  });
});
