const KEYS = {
  nickname:  'profile_nickname',
  birthDate: 'profile_birth_date',
  slogan:    'profile_slogan',
} as const;

export const DEFAULT_NICKNAME = 'Alex_King';
export const DEFAULT_SLOGAN = 'Ставлю вот такую стопку белых фишек';

export function getNickname(): string {
  return localStorage.getItem(KEYS.nickname) || DEFAULT_NICKNAME;
}

export function getBirthDate(): string {
  return localStorage.getItem(KEYS.birthDate) || '';
}

export function getSlogan(): string {
  return localStorage.getItem(KEYS.slogan) || DEFAULT_SLOGAN;
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
