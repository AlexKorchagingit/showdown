import { describe, expect, it } from 'vitest';
import { fileToTournamentImageUrl } from './tournamentPhoto';

describe('fileToTournamentImageUrl', () => {
  it('rejects an empty file before encoding', async () => {
    const empty = new File([], 'empty.jpg', { type: 'image/jpeg' });
    await expect(fileToTournamentImageUrl(empty)).rejects.toThrow('прочитать фото');
  });

  it('rejects a non-image file', async () => {
    const pdf = new File([new Uint8Array([1, 2, 3])], 'notes.pdf', { type: 'application/pdf' });
    await expect(fileToTournamentImageUrl(pdf)).rejects.toThrow('изображение');
  });
});
