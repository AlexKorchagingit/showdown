import { describe, expect, it } from 'vitest';
import { splitLobbyQueue } from './lobbyQueue';

describe('lobby waitlist', () => {
  const seats = [
    { id: 'c', joinedAt: '2026-10-06T12:00:00Z' },
    { id: 'a', joinedAt: '2026-10-06T10:00:00Z' },
    { id: 'b', joinedAt: '2026-10-06T11:00:00Z' },
    { id: 'd' },
  ];

  it('keeps the earliest signups in the field and the rest in signup order', () => {
    expect(splitLobbyQueue(seats, 2)).toEqual({
      field: [seats[1], seats[2]],
      queue: [seats[0], seats[3]],
    });
  });

  it('puts everyone in the field when the list is still inside the limit', () => {
    expect(splitLobbyQueue(seats, 27).queue).toEqual([]);
    expect(splitLobbyQueue(seats, 27).field).toHaveLength(4);
  });
});
