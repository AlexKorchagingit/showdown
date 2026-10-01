import { describe, expect, it } from 'vitest';
import { publicStackFeatureLines } from './chipStacks';
import { featuresWithStackDraft } from './stackFeatures';
import type { Tournament } from '../types/tournament';

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
