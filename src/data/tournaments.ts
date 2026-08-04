import type { Tournament } from '../types/tournament';
import { pickParticipants } from './participants';

const CLUB_ADDRESS = 'г. Брянск, ул. Покровская, 1';

/**
 * Mock dates are relative to today, so the automatic "upcoming / finished"
 * split stays meaningful no matter when the demo is opened.
 */
function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: '1',
    title: 'ROYAL FREEZEOUT',
    imageUrl: '/fishka.svg',
    address: CLUB_ADDRESS,
    startDate: dayOffset(1),
    startTime: '19:00',
    totalSeats: 36,
    guarantee: 19100,
    about:
      'Freezeout турнир для королей дисциплины. Без ре-энтри, без аддонов, без играющих дилеров. ' +
      'У вас единственный шанс доказать своё покерное превосходство! ' +
      'Сумеете ли вы им воспользоваться и побороться за самую большую гарантию очков недели?',
    features: [
      'Вход - 1500 рублей',
      'Неиграющие дилеры',
      'Глубокий стэк 50.000 - (500ББ)',
      'Плавная структура (до конца регистрации - 20 мин на уровень, после - 18 мин)',
      'Без ре-энтри',
      'Без аддонов',
      'Поздняя регистрация до 22:45',
    ],
    participants: pickParticipants(14),
    lateRegUntil: '22:45',
    blindStructure: 'Плавная',
    stackSize: 50000,
    levelDuration: '20/18 мин',
  },
  {
    id: '2',
    title: 'GOLDEN BOUNTY',
    imageUrl: '/fishka.svg',
    address: CLUB_ADDRESS,
    startDate: dayOffset(2),
    startTime: '15:00',
    totalSeats: 36,
    guarantee: 45000,
    about:
      'Прогрессивный нокаут-турнир с выбивными. Половина бай-ина идёт в общий приз, ' +
      'другая — на голову игрока. Каждый выбитый соперник пополняет ваш бонус. ' +
      'Агрессивная игра здесь не просто стиль — это стратегия победы.',
    features: [
      'Вход - 3000 рублей',
      'Прогрессивный нокаут (PKO)',
      'Неиграющие дилеры',
      'Стэк 40.000 (400ББ)',
      'Одно ре-энтри',
      'Поздняя регистрация до 16:30',
    ],
    participants: pickParticipants(8),
    lateRegUntil: '16:30',
    blindStructure: 'Стандартная',
    stackSize: 40000,
    levelDuration: '20 мин',
  },
  {
    id: '3',
    title: 'SATURDAY DEEPSTACK',
    imageUrl: '/fishka.svg',
    address: CLUB_ADDRESS,
    startDate: dayOffset(4),
    startTime: '17:00',
    totalSeats: 36,
    guarantee: 30000,
    about:
      'Еженедельный глубокий стэк — идеальная площадка для техничных игроков. ' +
      'Много фишек, долгие уровни, минимум удачи — максимум мастерства.',
    features: [
      'Вход - 2000 рублей',
      'Глубокий стэк 60.000 (600ББ)',
      'Неиграющие дилеры',
      'Структура 25 мин на уровень',
      'Без ре-энтри',
      'Поздняя регистрация до 19:00',
    ],
    participants: pickParticipants(19),
    lateRegUntil: '19:00',
    blindStructure: 'Медленная',
    stackSize: 60000,
    levelDuration: '25 мин',
  },
  {
    id: '4',
    title: 'TURBO CHAMPIONSHIP',
    imageUrl: '/fishka.svg',
    address: CLUB_ADDRESS,
    startDate: dayOffset(-7),
    startTime: '14:00',
    totalSeats: 36,
    guarantee: 12000,
    about:
      'Скоростной турнир для ценителей быстрой игры. Короткие уровни, быстрые решения, высокое напряжение.',
    features: [
      'Вход - 1000 рублей',
      'Турбо структура (10 мин)',
      'Два ре-энтри',
      'Стэк 20.000',
      'Поздняя регистрация до 15:00',
    ],
    participants: pickParticipants(20),
    lateRegUntil: '15:00',
    blindStructure: 'Турбо',
    stackSize: 20000,
    levelDuration: '10 мин',
  },
  {
    id: '5',
    title: 'KINGS CLASSIC',
    imageUrl: '/fishka.svg',
    address: CLUB_ADDRESS,
    startDate: dayOffset(-12),
    startTime: '19:00',
    totalSeats: 36,
    guarantee: 19100,
    about: 'Классический фризаут для настоящих мастеров. Один шанс — одна победа.',
    features: [
      'Вход - 1500 рублей',
      'Неиграющие дилеры',
      'Глубокий стэк 50.000',
      'Без ре-энтри',
      'Поздняя регистрация до 20:30',
    ],
    participants: pickParticipants(16),
    lateRegUntil: '20:30',
    blindStructure: 'Плавная',
    stackSize: 50000,
    levelDuration: '18 мин',
  },
];
