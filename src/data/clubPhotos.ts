import { asset } from '../lib/assets';

export type ClubPhoto = {
  file: string;
  label: string;
};

/** Club gallery for About → General (`public/club/<file>`). */
export const CLUB_PHOTOS: ClubPhoto[] = [
  { file: 'poker-table.jpg', label: 'Зал клуба' },
  { file: 'in-play.jpg', label: 'Игровой стол' },
  { file: 'chip-tray.jpg', label: 'Фишки' },
  { file: 'club-cap.jpg', label: 'Атмосфера' },
  { file: 'community.jpg', label: 'Комьюнити' },
];

export function clubPhotoSrc(file: string): string {
  return asset(`/club/${file}`);
}
