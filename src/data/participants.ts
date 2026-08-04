import type { Participant } from '../types/tournament';

export type { Participant };

export const ALL_PARTICIPANTS: Participant[] = [
  { id: '1',  nickname: 'Alex_King',     rating: 4200 },
  { id: '2',  nickname: 'DmitriyVP',     rating: 3850 },
  { id: '3',  nickname: 'MikhailS',      rating: 3610 },
  { id: '4',  nickname: 'AndreyPP',      rating: 2980 },
  { id: '5',  nickname: 'SergeyN',       rating: 2740 },
  { id: '6',  nickname: 'IvanKuznetsov', rating: 2510 },
  { id: '7',  nickname: 'OlegMaster',    rating: 2380 },
  { id: '8',  nickname: 'ArtemVolkov',   rating: 2150 },
  { id: '9',  nickname: 'NikolaevD',     rating: 1970 },
  { id: '10', nickname: 'PavelCar',      rating: 1810 },
  { id: '11', nickname: 'VasilyK',       rating: 1650 },
  { id: '12', nickname: 'RomanZ',        rating: 1540 },
  { id: '13', nickname: 'TimurB',        rating: 1420 },
  { id: '14', nickname: 'KirillM',       rating: 1310 },
  { id: '15', nickname: 'AlinaP',        rating: 1200 },
  { id: '16', nickname: 'StasR',         rating: 1080 },
  { id: '17', nickname: 'YuriF',         rating:  970 },
  { id: '18', nickname: 'NataV',         rating:  860 },
  { id: '19', nickname: 'GlebS',         rating:  750 },
  { id: '20', nickname: 'MaximN',        rating:  640 },
];

/** Independent copies so edits in one tournament never leak into another. */
export function pickParticipants(count: number): Participant[] {
  return ALL_PARTICIPANTS.slice(0, count).map((p) => ({ ...p }));
}
