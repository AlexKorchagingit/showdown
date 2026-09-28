import { describe, expect, it } from 'vitest';
import { isCustomTournamentArt, tournamentArtClassName } from './tournamentArt';

describe('isCustomTournamentArt', () => {
  it('treats bundled catalog WEBPs as catalog art', () => {
    expect(isCustomTournamentArt('/tournaments/ticket.webp')).toBe(false);
    expect(isCustomTournamentArt('tournaments/glass.webp')).toBe(false);
    expect(isCustomTournamentArt('/showdown/tournaments/phoenix.webp')).toBe(false);
    expect(isCustomTournamentArt('https://showdown-br.ru/tournaments/crown.webp')).toBe(false);
    expect(isCustomTournamentArt('/tournaments/ticket.webp?v=2')).toBe(false);
  });

  it('treats uploaded data URLs, blobs and foreign hosts as custom photos', () => {
    expect(isCustomTournamentArt('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(isCustomTournamentArt('blob:https://showdown-br.ru/abc')).toBe(true);
    expect(isCustomTournamentArt('https://cdn.example/photo.jpg')).toBe(true);
  });

  it('ignores empty urls', () => {
    expect(isCustomTournamentArt('')).toBe(false);
    expect(isCustomTournamentArt('   ')).toBe(false);
  });
});

describe('tournamentArtClassName', () => {
  it('keeps the right-edge catalog crop', () => {
    expect(tournamentArtClassName('opening')).toContain('object-right');
    expect(tournamentArtClassName('unknown-event')).toContain('scale-75');
  });
});
