import { describe, expect, it } from 'vitest';
import { publicStackFeatureLines, timerChipTotals } from './chipStacks';
import {
  featuresWithStackDraft,
  isLegacyStartingStackLine,
  parseStackAmount,
  parseStackFeatureLine,
} from './stackFeatures';
import type { Tournament } from '../types/tournament';
import type { BlindLevel } from '../data/blindStructures';
import type { Transaction } from '../types/finance';

function event(features: string[], stackSize = 30000): Tournament {
  return {
    id: 't',
    title: 'T',
    imageUrl: '',
    address: '',
    startDate: '2026-10-01',
    startTime: '19:00',
    totalSeats: 27,
    guarantee: 0,
    about: '',
    features,
    participants: [],
    lateRegUntil: '',
    blindStructure: '',
    stackSize,
    levelDuration: '',
    isClosed: false,
  };
}

describe('stack amount edges', () => {
  it('accepts grouped numbers and rejects a blind count or a half-typed value', () => {
    expect(parseStackAmount('50 000')).toBe(50000);
    expect(parseStackAmount('50\u00a0000')).toBe(50000);
    expect(parseStackAmount('1000')).toBe(1000);
    expect(parseStackAmount('999')).toBeNull();
    expect(parseStackAmount('5')).toBeNull();
    expect(parseStackAmount('')).toBeNull();
    expect(parseStackAmount('500 бб')).toBeNull();
    expect(parseStackFeatureLine('Стартовый стек: 500')).toBeNull();
  });

  it('does not treat a rebuy sentence as the starting-stack line', () => {
    expect(isLegacyStartingStackLine('Начальный стек 50 000 (500 бб)')).toBe(true);
    expect(isLegacyStartingStackLine('Ре-энтри за тройной стартовый стек')).toBe(false);
  });

  it('drops an equal rebuy and keeps the other bullets', () => {
    expect(featuresWithStackDraft(
      ['Начальный стек 30 000 (300 бб)', 'Стек ребая: 30 000', 'Без ограничений по ре-энтри'],
      { starting: 30000, rebuy: 30000, addon: null },
    )).toEqual(['Стартовый стек: 30 000', 'Без ограничений по ре-энтри']);
  });

  it('keeps a legacy starting stack on the public list and ignores a break note', () => {
    const tournament = event(['Начальный стек 50 000 (500 бб)', 'Дилеры не играют']);
    expect(publicStackFeatureLines(tournament)).toEqual([
      'Стартовый стек: 50 000',
      'Дилеры не играют',
    ]);
    const totals = timerChipTotals(
      tournament,
      [{
        level: 1,
        smallBlind: 100,
        bigBlind: 200,
        ante: 200,
        durationMinutes: 15,
        isBreak: true,
        comment: 'Аддон 99 000',
      }] as BlindLevel[],
      [{ id: '1', tournamentId: 't', userId: 'u', type: 'addon', amount: 1000, status: 'paid', comment: '', date: '', isDealer: false, dealerHours: 0 }] as Transaction[],
    );
    expect(totals.addonStack).not.toBe(99000);
    expect(totals.startingStack).toBe(50000);
  });
});

describe('stack feature lines', () => {
  it('hides a rebuy that matches the entry and an addon that is not set', () => {
    const lines = publicStackFeatureLines(event([
      'Стартовый стек: 50 000',
      'Стек ребая: 50 000',
      'Дилеры не играют',
    ]));
    expect(lines).toEqual(['Стартовый стек: 50 000', 'Дилеры не играют']);
  });

  it('shows a different rebuy and an addon number', () => {
    const features = featuresWithStackDraft(['Без ограничений по ре-энтри'], {
      starting: 30000,
      rebuy: 90000,
      addon: 30000,
    });
    expect(publicStackFeatureLines(event(features))).toEqual([
      'Стартовый стек: 30 000',
      'Стек ребая: 90 000',
      'Стек аддона: 30 000',
      'Без ограничений по ре-энтри',
    ]);
  });
});
