import type { Tournament } from '../types/tournament';
import { pickParticipants } from './participants';
import { asset } from '../lib/assets';
import { CLUB_ADDRESS } from '../lib/clubAddress';
import { applyPlaceToParticipant, knockoutBountyPoints } from './prizeStructure';

export const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: 'opening',
    title: 'Grand Opening',
    imageUrl: asset('/tournaments/glass.webp'),
    address: CLUB_ADDRESS,
    startDate: '2026-08-22',
    startTime: '17:00',
    totalSeats: 36,
    guarantee: 20000,
    about:
      'Грандиозное начало новой покерной истории! Торжественный турнир в честь открытия, где атмосфера праздника встречается с бескомпромиссной борьбой за сукном. Звон бокалов, новые лица, амбициозные цели и возможность с первого же дня захватить лидерство в сезоне. Займите свое место за столом — пора написать первую победную главу!',
    features: [
      'Вход БЕСПЛАТНЫЙ',
      'Начальный стек 30000 (300 бб)',
      'Без ограничений по ре-энтри',
      'Плавная структура турнира',
      'Поздняя регистрация до 21:10',
    ],
    participants: pickParticipants(12),
    lateRegUntil: '21:10',
    blindStructure: 'Grand Opening',
    stackSize: 30000,
    levelDuration: '20/15 мин',
    isClosed: false,
  },
  {
    id: 'freeroll',
    title: 'Freeroll',
    imageUrl: asset('/tournaments/ticket.webp'),
    address: CLUB_ADDRESS,
    startDate: '2026-08-24',
    startTime: '19:00',
    totalSeats: 36,
    guarantee: 8000,
    about:
      'Идеальный старт для новичков и отличная разминка для профи! Турнир без стартового взноса, где ваш главный капитал — это ваше мастерство. Никаких рисков, только чистый покер, бесценный опыт и реальная возможность заработать первые рейтинговые очки. Хватайте свой счастливый билет и покажите за столом, на что вы способны!',
    features: [
      'Вход БЕСПЛАТНЫЙ',
      'Начальный стек 30000 (300 бб)',
      'Без ограничений по ре-энтри',
      'Есть возможность взять аддон',
      'Классическая структура турнира',
      'Поздняя регистрация до 22:10',
    ],
    participants: pickParticipants(18),
    lateRegUntil: '22:10',
    blindStructure: 'Freeroll',
    stackSize: 30000,
    levelDuration: '15/12 мин',
    isClosed: false,
  },
  {
    id: 'triple-life',
    title: 'Triple Life',
    imageUrl: asset('/tournaments/hearts.webp'),
    address: CLUB_ADDRESS,
    startDate: '2026-08-25',
    startTime: '19:00',
    totalSeats: 36,
    guarantee: 12000,
    about:
      'Формат для тех, кто умеет делать выводы из своих ошибок. У вас есть ровно три «жизни», чтобы добраться до финального стола. Играйте агрессивно, рискуйте, проверяйте оппонентов на прочность, но помните: лимит исчерпаем. Каждое возвращение в игру должно быть острее предыдущего. Распределите свои шансы с умом и заберите свое по праву!',
    features: [
      'Начальный стек 30000 (300 бб)',
      'Ограничение по ре-энтри в 3 шт.',
      'Классическая структура турнира',
      'Поздняя регистрация до 22:10',
    ],
    participants: pickParticipants(15),
    lateRegUntil: '22:10',
    blindStructure: 'Triple Life',
    stackSize: 30000,
    levelDuration: '15 мин',
    isClosed: false,
  },
  {
    id: 'phoenix',
    title: 'Phoenix',
    imageUrl: asset('/tournaments/phoenix.webp'),
    address: CLUB_ADDRESS,
    startDate: '2026-08-26',
    startTime: '19:00',
    totalSeats: 36,
    guarantee: 12000,
    about:
      'Турнир, в котором никто не сдается до самого конца. Потеряли стек на обидном бэд-бите? Не беда! Восстаньте из пепла, возвращайтесь в игру и покажите, что настоящие чемпионы умеют делать грандиозные камбэки. Пламя азарта будет гореть до последней раздачи. Докажите всем за столом, что вас просто невозможно сломить!',
    features: [
      'Начальный стек 30000 (300 бб)',
      'Ограничение по рэ-энтри в 1 шт. за двойной стартовый стек',
      'Классическая структура турнира',
      'Поздняя регистрация до 22:10',
    ],
    participants: pickParticipants(14),
    lateRegUntil: '22:10',
    blindStructure: 'Phoenix',
    stackSize: 30000,
    levelDuration: '15/12 мин',
    isClosed: false,
  },
  {
    id: 'freezeout',
    title: 'Freezeout',
    imageUrl: asset('/tournaments/chip_frozen.webp'),
    address: CLUB_ADDRESS,
    startDate: '2026-08-27',
    startTime: '19:00',
    totalSeats: 36,
    guarantee: 15000,
    about:
      'Турнир для королей дисциплины. Без ре-энтри, без аддонов, без вторых шансов. У вас есть единственный патрон, чтобы доказать своё покерное превосходство. Одно неверное решение — и вы зритель. Сумеете ли вы сохранить хладнокровие, воспользоваться своим единственным шансом и побороться за самую престижную гарантию очков?',
    features: [
      'Вход – 1500 р.',
      'Начальный стек 30000 (300 бб)',
      'Без возможности ре-энтри',
      'Плавная структура турнира',
      'Поздняя регистрация до 22:10',
    ],
    participants: pickParticipants(16),
    lateRegUntil: '22:10',
    blindStructure: 'Freezeout',
    stackSize: 30000,
    levelDuration: '15 мин',
    isClosed: false,
  },
  {
    id: 'chill-out',
    title: 'Chill out',
    imageUrl: asset('/tournaments/crown.webp'),
    address: CLUB_ADDRESS,
    startDate: '2026-08-28',
    startTime: '19:00',
    totalSeats: 36,
    guarantee: 10000,
    about:
      'Классика покера в самой расслабленной и вкусной атмосфере Клуба! Бесконечные ребаи, мощный аддон в перерыве и море экшена за столами. Идеальный вечер, чтобы отдохнуть в компании друзей. Играйте раскованно, собирайте невероятные комбинации и забирайте корону победителя в максимально комфортных условиях!',
    features: [
      'Начальный стек 30000 (300 бб)',
      'Без ограничений по ре-энтри',
      'Есть возможность взять аддон',
      'Классическая структура турнира',
      'Поздняя регистрация до 22:10',
    ],
    participants: (() => {
      const list = pickParticipants(20);
      // Last five are already eliminated (places 16–20) so the missing-places warning shows.
      return list.map((p, index) => {
        const placed = index < 15 ? p : applyPlaceToParticipant(p, index + 1, 10000, list.length);
        if (p.id === '16') return { ...placed, comment: 'Спорный нокаут на баббле' };
        if (p.id === '18') return { ...placed, comment: 'Ушёл без расчёта' };
        return placed;
      });
    })(),
    lateRegUntil: '22:10',
    blindStructure: 'Chill out',
    stackSize: 30000,
    levelDuration: '15/12 мин',
    isClosed: true,
    dealers: [
      { name: 'Игорь', hours: 5, minutes: 0, loggedAt: '2026-08-12T23:10:00' },
      { name: 'Павел С.', hours: 3, minutes: 30, loggedAt: '2026-08-12T23:12:00' },
    ],
  },
  {
    id: 'bounty-hunter',
    title: 'Bounty Hunter',
    imageUrl: asset('/tournaments/skull.webp'),
    address: CLUB_ADDRESS,
    startDate: '2026-08-29',
    startTime: '17:00',
    totalSeats: 36,
    guarantee: 10000,
    about:
      'Объявляем сезон охоты открытым! В этом турнире агрессия щедро вознаграждается: за каждого выбитого оппонента вы получаете дополнительные очки. Никакой отсидки в глухой обороне — здесь побеждают хищники. Присматривайтесь к коротким стекам, готовьте ловушки и забирайте награду за головы своих соперников. Кто станет главным охотником этого вечера?',
    features: [
      'Доп. гарантия очков за выбивание оппонентов',
      'Начальный стек 30000 (300 бб)',
      'Без ограничений по ре-энтри',
      'Плавная структура турнира',
      'Поздняя регистрация до 21:10',
    ],
    participants: (() => {
      const list = pickParticipants(13);
      const knockouts = [4, 3, 3, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0];
      return list.map((player, index) => {
        const placed = applyPlaceToParticipant(player, index + 1, 10000, list.length);
        const ko = knockouts[index] ?? 0;
        return {
          ...placed,
          knockouts: ko,
          rating: placed.rating + knockoutBountyPoints(ko),
        };
      });
    })(),
    lateRegUntil: '21:10',
    blindStructure: 'Bounty Hunter',
    stackSize: 30000,
    levelDuration: '20/15 мин',
    isClosed: true,
    isBounty: true,
    resultsEntered: true,
  },
  {
    id: 'deepstack',
    title: 'Deepstack',
    imageUrl: asset('/tournaments/helmet.webp'),
    address: CLUB_ADDRESS,
    startDate: '2026-08-30',
    startTime: '17:00',
    totalSeats: 36,
    guarantee: 15000,
    about:
      'Турнир для настоящих стратегов и ценителей интеллектуального покера. Забудьте про лотерею на первых уровнях! Огромный стартовый стек и плавная структура блайндов дают максимальное пространство для маневров, красивых блефов и сложных розыгрышей на постфлопе. Это марафон, а не спринт. Хватит ли вам выдержки переиграть оппонентов на длинной дистанции?',
    features: [
      'Начальный стек 50000 (500 бб)',
      'Без ограничений по ре-энтри',
      'Плавная структура турнира',
      'Поздняя регистрация до 21:10',
    ],
    participants: pickParticipants(11),
    lateRegUntil: '21:10',
    blindStructure: 'Deepstack',
    stackSize: 50000,
    levelDuration: '20/15 мин',
    isClosed: false,
  },
];
