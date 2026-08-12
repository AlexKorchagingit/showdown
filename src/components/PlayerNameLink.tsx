import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { PublicProfileStats } from '../lib/playerName';

interface Props {
  id: string;
  nickname: string;
  className?: string;
  style?: CSSProperties;
  stats?: Omit<PublicProfileStats, 'nickname'>;
}

/** Clickable nickname that opens that player's read-only profile. */
export function PlayerNameLink({ id, nickname, className, style, stats }: Props) {
  const to = id === 'me' ? '/profile' : `/profile/${encodeURIComponent(id)}`;

  return (
    <Link
      to={to}
      state={{ nickname, ...stats }}
      className={['active:opacity-70 transition-opacity', className].filter(Boolean).join(' ')}
      style={style}
    >
      {nickname}
    </Link>
  );
}
