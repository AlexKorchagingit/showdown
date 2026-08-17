import { loadUserData, STARTING_COINS } from '../lib/userStorage';
import { avatarUrlForChar, DEFAULT_CHARACTER_ID } from './shopItems';

export interface MockUser {
  id: string;
  email: string;
  nickname: string;
  isAdmin: boolean;
  /** Demo ruby balance shown / seeded for admin flows. */
  coins: number;
  /** Shop character currently worn; drives `equippedAvatar`. */
  equippedChar?: string;
  /** Head-shot of the equipped shop character, or the default cat. */
  readonly equippedAvatar: string;
}

export function equippedAvatarOf(
  user: Pick<MockUser, 'email' | 'equippedChar'>,
): string {
  const saved = user.email ? loadUserData(user.email).equippedChar : '';
  return avatarUrlForChar(saved || user.equippedChar || DEFAULT_CHARACTER_ID);
}

function withAvatar(user: Omit<MockUser, 'equippedAvatar'>): MockUser {
  const row = { ...user } as MockUser;
  Object.defineProperty(row, 'equippedAvatar', {
    enumerable: true,
    get() {
      return equippedAvatarOf(row);
    },
  });
  return row;
}

export const mockUsers: MockUser[] = (
  [
    { id: '1', email: 'anaak-01@mail.ru',           nickname: 'Admin_Master',  isAdmin: true,  coins: STARTING_COINS },
    { id: '9', email: 'kirillbaranets1@gmail.com',  nickname: 'KirillB',       isAdmin: true,  coins: STARTING_COINS },
    { id: '2', email: 'alex.king@mail.ru',          nickname: 'Alex_King',     isAdmin: false, coins: STARTING_COINS },
    { id: '3', email: 'dmitry.v@mail.ru',           nickname: 'DmitriyVP',     isAdmin: false, coins: STARTING_COINS },
    { id: '4', email: 'mikhail.s@mail.ru',          nickname: 'MikhailS',      isAdmin: false, coins: STARTING_COINS },
    { id: '5', email: 'andrey.pp@mail.ru',          nickname: 'AndreyPP',      isAdmin: false, coins: STARTING_COINS },
    { id: '6', email: 'sergey.n@mail.ru',           nickname: 'SergeyN',       isAdmin: false, coins: STARTING_COINS },
    { id: '7', email: 'ivan.k@mail.ru',             nickname: 'IvanKuznetsov', isAdmin: false, coins: STARTING_COINS },
    { id: '8', email: 'oleg.m@mail.ru',             nickname: 'OlegMaster',    isAdmin: false, coins: STARTING_COINS },
  ] satisfies Omit<MockUser, 'equippedAvatar'>[]
).map(withAvatar);
