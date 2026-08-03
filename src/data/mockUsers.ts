export interface MockUser {
  id:       string;
  email:    string;
  nickname: string;
  isAdmin:  boolean;
}

export const mockUsers: MockUser[] = [
  { id: '1', email: 'anaak-01@mail.ru',   nickname: 'Admin_Master', isAdmin: true },
  { id: '2', email: 'alex.king@mail.ru',  nickname: 'Alex_King',    isAdmin: false },
  { id: '3', email: 'dmitry.v@mail.ru',   nickname: 'DmitriyVP',    isAdmin: false },
  { id: '4', email: 'mikhail.s@mail.ru',  nickname: 'MikhailS',     isAdmin: false },
  { id: '5', email: 'andrey.pp@mail.ru',  nickname: 'AndreyPP',     isAdmin: false },
  { id: '6', email: 'sergey.n@mail.ru',   nickname: 'SergeyN',      isAdmin: false },
  { id: '7', email: 'ivan.k@mail.ru',     nickname: 'IvanKuznetsov', isAdmin: false },
  { id: '8', email: 'oleg.m@mail.ru',     nickname: 'OlegMaster',   isAdmin: false },
];
