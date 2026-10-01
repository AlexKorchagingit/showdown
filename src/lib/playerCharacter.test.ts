import { describe, expect, it } from 'vitest';
import { avatarUrlForChar, DEFAULT_CHARACTER_ID } from '../data/shopItems';
import { avatarUrlForPlayer, equippedCharForPlayer } from './playerCharacter';

describe('guest avatars', () => {
  it('uses the base cat for a nick-only seat even when the viewer wears another character', () => {
    const cat = avatarUrlForChar(DEFAULT_CHARACTER_ID);
    expect(equippedCharForPlayer('guest-пафнутий', 'Пафнутий', 'char_king')).toBe(DEFAULT_CHARACTER_ID);
    expect(equippedCharForPlayer('opening:guest-ivan', 'Иван', 'char_king')).toBe(DEFAULT_CHARACTER_ID);
    expect(avatarUrlForPlayer('guest-пафнутий', 'Пафнутий', 'char_king')).toBe(cat);
    expect(avatarUrlForPlayer('t-1:guest-панфутий', 'Панфутий', 'char_fortune')).toBe(cat);
  });
});
