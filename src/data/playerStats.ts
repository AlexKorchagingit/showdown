export interface PlayerStats {
  /** Всего сыгранных турниров */
  games: number;
  /** Выбито игроков за всё время */
  knockouts: number;
  /** Попаданий в топ-9 (финальный стол) */
  finals: number;
  /** Побед — топ-1 */
  wins: number;
  /** Текущее место в рейтинге сезона */
  ratingPlace: number;
  /** Хедз-ап — топ-2 */
  headsUp: number;
  /** Попаданий в топ-3 */
  top3: number;
  /** Нокауты за текущий месяц */
  monthlyKnockouts: number;
  /** Лучший результат по нокаутам за один турнир */
  bestTournamentKnockouts: number;
  /** Приведено друзей в клуб */
  invitedFriends: number;
}

export const CURRENT_PLAYER_STATS: PlayerStats = {
  games: 28,
  knockouts: 47,
  finals: 12,
  wins: 5,
  ratingPlace: 12,
  headsUp: 3,
  top3: 7,
  monthlyKnockouts: 14,
  bestTournamentKnockouts: 6,
  invitedFriends: 0,
};
