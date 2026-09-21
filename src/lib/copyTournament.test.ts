import { describe, expect, it } from 'vitest';
import type { Participant, Tournament } from '../types/tournament';
import { copiedTournamentDraft } from './copyTournament';
import { resetCopiedParticipant, tournamentToRow } from './supabaseMap';

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, nickname: id, rating: 1200, ...patch };
}

function event(patch: Partial<Tournament> = {}): Tournament {
  return {
    id: 'source',
    title: 'BOUNTY HUNTER',
    imageUrl: '/tournaments/bounty.webp',
    address: 'Club',
    startDate: '2026-09-20',
    startTime: '17:00',
    totalSeats: 27,
    guarantee: 10000,
    about: 'Описание',
    features: ['Ре-энтри', 'Аддон'],
    participants: [],
    lateRegUntil: '21:00',
    blindStructure: 'Bounty',
    blindStructureId: 'bs-bounty',
    stackSize: 30000,
    levelDuration: '20 мин',
    isClosed: true,
    isBounty: true,
    hidden: true,
    resultsEntered: true,
    rubiesDistributed: true,
    adminSecretComment: 'Спорный нокаут, два ре-энтри без оплаты',
    dealers: [{ name: 'Артём', hours: 5, minutes: 30, comment: 'Смена' }],
    staff: [{ role: 'Админ', name: 'Касса', hours: 6, minutes: 0 }],
    results: [player('winner', { place: 1 })],
    ...patch,
  };
}

describe('copiedTournamentDraft', () => {
  it('clears cashier tournament comments so the copy starts blank', () => {
    const draft = copiedTournamentDraft(event(), []);
    expect(draft.adminSecretComment).toBeUndefined();
    expect(tournamentToRow({ ...draft, id: 'copy' }).admin_secret_comment).toBeNull();
  });

  it('keeps event settings and drops close-state, personnel and finishing table', () => {
    const source = event();
    const draft = copiedTournamentDraft(source, [player('1')]);
    expect(draft.title).toBe('BOUNTY HUNTER Copy');
    expect(draft.about).toBe('Описание');
    expect(draft.features).toEqual(['Ре-энтри', 'Аддон']);
    expect(draft.features).not.toBe(source.features);
    expect(draft.isClosed).toBe(false);
    expect(draft.hidden).toBe(false);
    expect(draft.resultsEntered).toBe(false);
    expect(draft.rubiesDistributed).toBe(false);
    expect(draft.isBounty).toBe(true);
    expect(draft.dealers).toBeUndefined();
    expect(draft.staff).toBeUndefined();
    expect(draft.results).toBeUndefined();
    expect(draft.participants).toEqual([player('1')]);
  });

  it('does not carry per-player cashier comments or finishing stats on copied seats', () => {
    const seat = resetCopiedParticipant(
      player('egor', {
        place: 1,
        knockouts: 11,
        rubiesAwarded: 2105,
        comment: 'должен 1000',
        arrived: true,
      }),
    );
    expect(seat.id).toBe('egor');
    expect(seat.nickname).toBe('egor');
    expect(seat.arrived).toBe(false);
    expect(seat.place).toBeUndefined();
    expect(seat.knockouts).toBeUndefined();
    expect(seat.rubiesAwarded).toBeUndefined();
    expect(seat.comment).toBeUndefined();
    const draft = copiedTournamentDraft(event(), [seat]);
    expect(draft.participants[0]?.comment).toBeUndefined();
  });
});
