/** Named confirmation so a stray tap cannot drop a player from a tournament. */
export function removeTournamentPlayerConfirm(nickname: string, tournamentTitle: string): string {
  const name = nickname.trim() || 'этого игрока';
  const title = tournamentTitle.trim() || 'этот турнир';
  return `Удалить ${name} из турнира «${title}»?\n\nИгрок пропадёт из списка. Удаление выполнится только после подтверждения.`;
}
