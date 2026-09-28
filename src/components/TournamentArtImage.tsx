import {
  CATALOG_TOURNAMENT_ART_STYLE,
  CUSTOM_TOURNAMENT_ART_CLASS,
  CUSTOM_TOURNAMENT_ART_STYLE,
  isCustomTournamentArt,
  tournamentArtClassName,
} from '../lib/tournamentArt';

export function TournamentArtImage({
  src,
  tournamentId,
  custom,
}: {
  src: string;
  tournamentId: string;
  custom?: boolean;
}) {
  if (!src.trim()) return null;
  const isCustom = custom ?? isCustomTournamentArt(src);
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={isCustom ? CUSTOM_TOURNAMENT_ART_CLASS : tournamentArtClassName(tournamentId)}
      style={isCustom ? CUSTOM_TOURNAMENT_ART_STYLE : CATALOG_TOURNAMENT_ART_STYLE}
    />
  );
}
