export interface RatingPlayer {
  id:        string;
  nickname:  string;
  initial:   string;
  points:    number;   // season/total rating score
  played:    number;   // games played
  won:       number;   // tournament wins
  knockouts: number;   // bounty knockouts
}

export const MOCK_PLAYERS_GENERAL: RatingPlayer[] = [
  { id: '1', nickname: 'Александр К.', initial: 'А', points: 4200, played: 28, won: 5, knockouts: 47 },
  { id: '2', nickname: 'Дмитрий В.',   initial: 'Д', points: 3850, played: 24, won: 3, knockouts: 38 },
  { id: '3', nickname: 'Михаил С.',    initial: 'М', points: 3610, played: 22, won: 2, knockouts: 29 },
  { id: '4', nickname: 'Андрей П.',    initial: 'А', points: 2980, played: 18, won: 1, knockouts: 21 },
  { id: '5', nickname: 'Сергей Н.',    initial: 'С', points: 2740, played: 17, won: 1, knockouts: 18 },
  { id: '6', nickname: 'Иван К.',      initial: 'И', points: 2510, played: 15, won: 0, knockouts: 14 },
  { id: '7', nickname: 'Олег М.',      initial: 'О', points: 2380, played: 14, won: 0, knockouts: 12 },
  { id: '8', nickname: 'Артём В.',     initial: 'А', points: 2150, played: 13, won: 0, knockouts: 9  },
  { id: '9', nickname: 'Николаев Д.',  initial: 'Н', points: 1970, played: 11, won: 0, knockouts: 7  },
  { id: '10', nickname: 'Alex_King',   initial: 'A', points: 1580, played: 9,  won: 0, knockouts: 5  },
];

export const MOCK_PLAYERS_SEASONAL: Record<number, RatingPlayer[]> = {
  // month index (0-based), currently showing July (6)
  6: [
    { id: '1', nickname: 'Дмитрий В.',   initial: 'Д', points: 1200, played: 8,  won: 2, knockouts: 14 },
    { id: '2', nickname: 'Александр К.', initial: 'А', points: 1050, played: 7,  won: 1, knockouts: 11 },
    { id: '3', nickname: 'Артём В.',     initial: 'А', points:  840, played: 6,  won: 1, knockouts: 8  },
    { id: '4', nickname: 'Михаил С.',    initial: 'М', points:  720, played: 5,  won: 0, knockouts: 6  },
    { id: '5', nickname: 'Alex_King',    initial: 'A', points:  510, played: 4,  won: 0, knockouts: 3  },
    { id: '6', nickname: 'Сергей Н.',    initial: 'С', points:  480, played: 4,  won: 0, knockouts: 2  },
  ],
  5: [
    { id: '1', nickname: 'Александр К.', initial: 'А', points: 1380, played: 9,  won: 3, knockouts: 17 },
    { id: '2', nickname: 'Иван К.',      initial: 'И', points:  960, played: 7,  won: 1, knockouts: 9  },
    { id: '3', nickname: 'Михаил С.',    initial: 'М', points:  840, played: 6,  won: 0, knockouts: 7  },
  ],
};

// Current logged-in user summary
export const CURRENT_USER_RATING = {
  rank:     42,
  nickname: 'Alex_King',
  initial:  'A',
  points:   1580,
};
