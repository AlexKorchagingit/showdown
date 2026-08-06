import { CURRENT_PLAYER_STATS as S } from './playerStats';

export type AchievementTier = 'gold' | 'silver' | 'ruby';

export type AchievementIcon =
  | 'fish'
  | 'shark'
  | 'megalodon'
  | 'welcome'
  | 'crown'
  | 'bounty'
  | 'predator'
  | 'hunter'
  | 'winner'
  | 'royal'
  | 'straight'
  | 'quads'
  | 'ranked'
  | 'finalist'
  | 'photo'
  | 'bubble'
  | 'friend'
  | 'resident'
  | 'punctual'
  | 'giantslayer';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  tier: AchievementTier;
  /** Progress goal; omit for one-shot achievements. */
  target?: number;
  progress?: number;
  /** Used by one-shot achievements that have no progress bar. */
  completed?: boolean;
}

/** Per-user override saved in localStorage by the admin editor. */
export interface AchievementProgress {
  progress?: number;
  completed?: boolean;
}

/** Progress never exceeds the goal, so a finished counter reads "10 / 10". */
function capped(value: number, target: number): number {
  return Math.min(value, target);
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'fish',
    title: 'Рыбка',
    description: 'Посетить 10 турниров в Клубе',
    icon: 'fish',
    tier: 'silver',
    target: 10,
    progress: capped(S.games, 10),
  },
  {
    id: 'crucian',
    title: 'Карась',
    description: 'Посетить 25 турниров в Клубе',
    icon: 'fish',
    tier: 'silver',
    target: 25,
    progress: capped(S.games, 25),
  },
  {
    id: 'shark',
    title: 'Акула',
    description: 'Посетить 50 турниров в Клубе',
    icon: 'shark',
    tier: 'gold',
    target: 50,
    progress: capped(S.games, 50),
  },
  {
    id: 'megalodon',
    title: 'Мегалодон',
    description: 'Посетить 100 турниров в Клубе',
    icon: 'megalodon',
    tier: 'gold',
    target: 100,
    progress: capped(S.games, 100),
  },
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Посетить свою 1-ю игру в Showdown',
    icon: 'welcome',
    tier: 'silver',
    completed: S.games >= 1,
  },
  {
    id: 'the-best',
    title: 'The Best',
    description: 'Стать топ-1 рейтинга за месяц',
    icon: 'crown',
    tier: 'gold',
    completed: false,
  },
  {
    id: 'bounty-king',
    title: 'Король Баунти',
    description: 'Стать топ-1 игроком по нокаутам за месяц',
    icon: 'bounty',
    tier: 'gold',
    completed: false,
  },
  {
    id: 'predator',
    title: 'Хищник',
    description: 'Сделать 25 нокаутов за месяц',
    icon: 'predator',
    tier: 'silver',
    target: 25,
    progress: capped(S.monthlyKnockouts, 25),
  },
  {
    id: 'headhunter',
    title: 'Охотник за головами',
    description: 'Сделать 10 нокаутов за турнир',
    icon: 'hunter',
    tier: 'silver',
    target: 10,
    progress: capped(S.bestTournamentKnockouts, 10),
  },
  {
    id: 'winner',
    title: 'Winner Winner',
    description: 'Выиграть любой турнир в клубе',
    icon: 'winner',
    tier: 'gold',
    completed: S.wins >= 1,
  },
  {
    id: 'royal-flush',
    title: 'Раз в жизни',
    description: 'Собрать Royal Flush на любой игре в Клубе',
    icon: 'royal',
    tier: 'ruby',
    completed: false,
  },
  {
    id: 'straight-flush',
    title: 'Лестница в небо',
    description: 'Собрать Straight Flush на любой игре в Клубе',
    icon: 'straight',
    tier: 'ruby',
    completed: false,
  },
  {
    id: 'four-kings',
    title: 'Совет королей',
    description: 'Собрать каре королей на любой игре в Клубе',
    icon: 'quads',
    tier: 'ruby',
    completed: false,
  },
  {
    id: 'in-the-clip',
    title: 'В обойме',
    description: 'Попасть в топ-27 рейтинга за месяц',
    icon: 'ranked',
    tier: 'silver',
    completed: S.ratingPlace <= 27,
  },
  {
    id: 'finalist',
    title: 'Финалист',
    description: 'Попасть в топ-9 финального стола',
    icon: 'finalist',
    tier: 'silver',
    completed: S.finals >= 1,
  },
  {
    id: 'paparazzi',
    title: 'Вспышка папарацци',
    description: 'Попасть в топ-3 для почетной фотографии',
    icon: 'photo',
    tier: 'gold',
    completed: S.top3 >= 1,
  },
  {
    id: 'bubble',
    title: 'Вечный Баббл',
    description: 'Стать бабблом очковой зоны (вылететь прямо перед призами)',
    icon: 'bubble',
    tier: 'silver',
    completed: false,
  },
  {
    id: 'friend',
    title: 'Свой человек',
    description: 'Привести друга первый раз в клуб',
    icon: 'friend',
    tier: 'silver',
    completed: S.invitedFriends >= 1,
  },
  {
    id: 'resident',
    title: 'Живет в клубе',
    description: 'Стать лидером по посещениям за месяц',
    icon: 'resident',
    tier: 'gold',
    completed: false,
  },
  {
    id: 'punctual',
    title: 'Пунктуальность',
    description: 'Получить страховку за приход вовремя',
    icon: 'punctual',
    tier: 'silver',
    completed: true,
  },
  {
    id: 'giant-slayer',
    title: 'Гроза авторитетов',
    description: 'Выбить из турнира Администратора клуба',
    icon: 'giantslayer',
    tier: 'ruby',
    completed: false,
  },
];

export function isAchievementDone(a: Achievement): boolean {
  if (a.target !== undefined) return (a.progress ?? 0) >= a.target;
  return a.completed === true;
}
