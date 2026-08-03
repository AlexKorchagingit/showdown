const KEYS = {
  nickname:  'profile_nickname',
  birthDate: 'profile_birth_date',
  slogan:    'profile_slogan',
} as const;

export const SLOGAN_PLACEHOLDER = 'Ставлю вот такую стопку белых фишек';

function generateDefaultNickname(): string {
  return `Личность№${Math.floor(Math.random() * 10000)}`;
}

export function getNickname(): string {
  const existing = localStorage.getItem(KEYS.nickname);
  if (existing) return existing;

  const generated = generateDefaultNickname();
  localStorage.setItem(KEYS.nickname, generated);
  return generated;
}

export function getBirthDate(): string {
  return localStorage.getItem(KEYS.birthDate) || '';
}

export function getSlogan(): string {
  return localStorage.getItem(KEYS.slogan) ?? '';
}

export function setNickname(value: string) {
  localStorage.setItem(KEYS.nickname, value);
}

export function setBirthDate(value: string) {
  localStorage.setItem(KEYS.birthDate, value);
}

export function setSlogan(value: string) {
  localStorage.setItem(KEYS.slogan, value);
}
