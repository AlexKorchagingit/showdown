import { asset } from '../lib/assets';

export type AchievementTier = 'gold' | 'silver' | 'ruby';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  tier: AchievementTier;
  /** Progress goal; omit for one-shot achievements. */
  target?: number;
  progress?: number;
  /** Used by one-shot achievements that have no progress bar. */
  completed?: boolean;
}

function art(id: string): string {
  return asset(`/achievements/${id}.webp`);
}

/** Per-user override saved on the server by the admin editor. */
export interface AchievementProgress {
  progress?: number;
  completed?: boolean;
}

/**
 * These badges fill from closed results. Admins can still raise them by hand;
 * auto-calc is a floor and does not wipe a larger grant.
 */
export const AUTO_ACHIEVEMENT_IDS = [
  'fish',
  'crucian',
  'shark',
  'megalodon',
  'welcome',
  'the-best',
  'bounty-king',
  'predator',
  'headhunter',
  'winner',
  'finalist',
  'paparazzi',
  'bubble',
  'resident',
] as const;

export type AutoAchievementId = (typeof AUTO_ACHIEVEMENT_IDS)[number];

export const AUTO_ACHIEVEMENT_ID_SET: ReadonlySet<string> = new Set(AUTO_ACHIEVEMENT_IDS);

/** Catalogue starts locked. Listed badges also fill from closed results. */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'fish',
    title: 'Рыбка',
    description: 'Посетить 10 турниров в Клубе',
    imageUrl: art('fish'),
    tier: 'silver',
    target: 10,
  },
  {
    id: 'crucian',
    title: 'Карась',
    description: 'Посетить 25 турниров в Клубе',
    imageUrl: art('crucian'),
    tier: 'silver',
    target: 25,
  },
  {
    id: 'shark',
    title: 'Акула',
    description: 'Посетить 50 турниров в Клубе',
    imageUrl: art('shark'),
    tier: 'gold',
    target: 50,
  },
  {
    id: 'megalodon',
    title: 'Мегалодон',
    description: 'Посетить 100 турниров в Клубе',
    imageUrl: art('megalodon'),
    tier: 'gold',
    target: 100,
  },
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Посетить свою 1-ю игру в Showdown',
    imageUrl: art('welcome'),
    tier: 'silver',
  },
  {
    id: 'the-best',
    title: 'The Best',
    description: 'Стать топ-1 рейтинга за месяц',
    imageUrl: art('the-best'),
    tier: 'gold',
  },
  {
    id: 'bounty-king',
    title: 'Король Баунти',
    description: 'Стать топ-1 игроком по нокаутам за месяц',
    imageUrl: art('bounty-king'),
    tier: 'gold',
  },
  {
    id: 'predator',
    title: 'Хищник',
    description: 'Сделать 25 нокаутов за месяц',
    imageUrl: art('predator'),
    tier: 'silver',
    target: 25,
  },
  {
    id: 'headhunter',
    title: 'Охотник за головами',
    description: 'Сделать 10 нокаутов за турнир',
    imageUrl: art('headhunter'),
    tier: 'silver',
    target: 10,
  },
  {
    id: 'winner',
    title: 'Winner Winner',
    description: 'Выиграть любой турнир в клубе',
    imageUrl: art('winner'),
    tier: 'gold',
  },
  {
    id: 'royal-flush',
    title: 'Раз в жизни',
    description: 'Собрать Royal Flush на любой игре в Клубе',
    imageUrl: art('royal-flush'),
    tier: 'ruby',
  },
  {
    id: 'straight-flush',
    title: 'Лестница в небо',
    description: 'Собрать Straight Flush на любой игре в Клубе',
    imageUrl: art('straight-flush'),
    tier: 'ruby',
  },
  {
    id: 'four-kings',
    title: 'Совет королей',
    description: 'Собрать каре королей на любой игре в Клубе',
    imageUrl: art('four-kings'),
    tier: 'ruby',
  },
  {
    id: 'in-the-clip',
    title: 'В обойме',
    description: 'Попасть в топ-27 рейтинга за месяц',
    imageUrl: art('in-the-clip'),
    tier: 'silver',
  },
  {
    id: 'finalist',
    title: 'Финалист',
    description: 'Попасть за финальный стол (призовая зона + баббл)',
    imageUrl: art('finalist'),
    tier: 'silver',
  },
  {
    id: 'paparazzi',
    title: 'Вспышка папарацци',
    description: 'Попасть в топ-3 для почетной фотографии',
    imageUrl: art('paparazzi'),
    tier: 'gold',
  },
  {
    id: 'bubble',
    title: 'Вечный Баббл',
    description: 'Стать бабблом очковой зоны (вылететь прямо перед призами)',
    imageUrl: art('bubble'),
    tier: 'silver',
  },
  {
    id: 'friend',
    title: 'Свой человек',
    description: 'Привести друга первый раз в клуб',
    imageUrl: art('friend'),
    tier: 'silver',
  },
  {
    id: 'resident',
    title: 'Живет в клубе',
    description: 'Стать лидером по посещениям за месяц',
    imageUrl: art('resident'),
    tier: 'gold',
  },
  {
    id: 'punctual',
    title: 'Пунктуальность',
    description: 'Прийти до начала турнира',
    imageUrl: art('punctual'),
    tier: 'silver',
  },
  {
    id: 'giant-slayer',
    title: 'Гроза авторитетов',
    description: 'Выбить из турнира Администратора клуба',
    imageUrl: art('giant-slayer'),
    tier: 'ruby',
  },
  {
    id: 'knock-karen',
    title: 'Выбить Карена',
    description: 'Выбить Карена из турнира. Награда: персонаж Карен.',
    imageUrl: art('knock-karen'),
    tier: 'ruby',
  },
];

export function isAchievementDone(a: Achievement): boolean {
  if (a.target !== undefined) return (a.progress ?? 0) >= a.target;
  return a.completed === true;
}
