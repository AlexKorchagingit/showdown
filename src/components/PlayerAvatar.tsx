import { useProfile } from '../context/ProfileContext';
import { DEFAULT_AVATAR_URL } from '../data/shopItems';
import { avatarUrlForPlayer } from '../lib/playerCharacter';

const SIZE_CLASS = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
} as const;

interface PlayerAvatarProps {
  playerId?: string;
  nickname?: string;
  src?: string;
  size?: keyof typeof SIZE_CLASS;
  glowColor?: string;
  className?: string;
}

export function PlayerAvatar({
  playerId,
  nickname,
  src,
  size = 'md',
  glowColor,
  className = '',
}: PlayerAvatarProps) {
  const { equippedChar, equippedAvatar } = useProfile();
  const url =
    src ??
    (playerId === 'me'
      ? equippedAvatar
      : playerId && nickname
        ? avatarUrlForPlayer(playerId, nickname, equippedChar)
        : DEFAULT_AVATAR_URL);

  return (
    <div className={`relative shrink-0 ${className}`}>
      {glowColor ? (
        <div
          className="absolute rounded-full pointer-events-none animate-pulse"
          style={{
            inset: '-3px',
            border: `2px solid ${glowColor}`,
            boxShadow: `0 0 10px ${glowColor}`,
          }}
        />
      ) : null}
      <img
        src={url}
        alt="avatar"
        className={`relative z-10 ${SIZE_CLASS[size]} object-contain rounded-full bg-[#231A16]`}
      />
    </div>
  );
}
