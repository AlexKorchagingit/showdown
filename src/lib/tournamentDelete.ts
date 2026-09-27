/** Copy shown before an admin physically deletes a tournament from the lobby. */
export function tournamentDeleteWarning(closed: boolean): { title: string; body: string } {
  if (closed) {
    return {
      title: 'Удалить закрытый турнир?',
      body:
        'Будут удалены все записи по оплатам. Очки по турниру у игроков будут удалены. Начисленные в рамках турнира рубины НЕ будут удалены.',
    };
  }
  return {
    title: 'Удалить турнир?',
    body: 'Турнир и его состав будут удалены. Записи кассы по этому событию тоже исчезнут.',
  };
}
