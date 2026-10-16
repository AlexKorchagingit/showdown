import type { CSSProperties, ReactNode } from 'react';
import {
  SUIT_COLORS,
  cardName,
  parseCard,
  rankLabel,
  type CardCode,
  type CardRank,
  type CardSuit,
} from '../lib/pokerCards';

/** Suit outlines drawn inside a 100 × 100 box, so the card never depends on a font. */
function suitShape(suit: CardSuit): ReactNode {
  switch (suit) {
    case 's':
      return (
        <path d="M50 4 C50 4 7 36 7 61 C7 76 19 85 32 85 C40 85 46 81 50 75 C49 86 45 93 37 97 L63 97 C55 93 51 86 50 75 C54 81 60 85 68 85 C81 85 93 76 93 61 C93 36 50 4 50 4 Z" />
      );
    case 'h':
      return (
        <path d="M50 94 C50 94 5 62 5 32 C5 15 18 5 31 5 C40 5 47 10 50 18 C53 10 60 5 69 5 C82 5 95 15 95 32 C95 62 50 94 50 94 Z" />
      );
    case 'd':
      return (
        <path d="M50 3 C56 22 75 40 93 50 C75 60 56 78 50 97 C44 78 25 60 7 50 C25 40 44 22 50 3 Z" />
      );
    case 'c':
      return (
        <>
          <circle cx="50" cy="28" r="22" />
          <circle cx="26" cy="62" r="22" />
          <circle cx="74" cy="62" r="22" />
          <circle cx="50" cy="55" r="14" />
          <path d="M50 52 C50 74 45 88 35 97 L65 97 C55 88 50 74 50 52 Z" />
        </>
      );
  }
}

/** A single suit sign, for lists and labels. */
export function SuitIcon({ suit, size = 14, color }: { suit: CardSuit; size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill={color ?? SUIT_COLORS[suit]} aria-hidden>
      {suitShape(suit)}
    </svg>
  );
}

function Pip({
  suit,
  x,
  y,
  size,
  flip = false,
  color,
}: {
  suit: CardSuit;
  x: number;
  y: number;
  size: number;
  flip?: boolean;
  color: string;
}) {
  const scale = size / 100;
  const transform = flip
    ? `translate(${x} ${y}) rotate(180) scale(${scale}) translate(-50 -50)`
    : `translate(${x} ${y}) scale(${scale}) translate(-50 -50)`;
  return (
    <g transform={transform} fill={color}>
      {suitShape(suit)}
    </g>
  );
}

const LEFT = 36;
const MID = 50;
const RIGHT = 64;

/** Standard pip layouts on a 100 × 140 card. Pips below the middle are turned over. */
const PIPS: Record<string, { size: number; spots: [number, number][] }> = {
  '2': { size: 30, spots: [[MID, 32], [MID, 108]] },
  '3': { size: 28, spots: [[MID, 32], [MID, 70], [MID, 108]] },
  '4': { size: 26, spots: [[LEFT, 32], [RIGHT, 32], [LEFT, 108], [RIGHT, 108]] },
  '5': { size: 26, spots: [[LEFT, 32], [RIGHT, 32], [MID, 70], [LEFT, 108], [RIGHT, 108]] },
  '6': { size: 26, spots: [[LEFT, 32], [RIGHT, 32], [LEFT, 70], [RIGHT, 70], [LEFT, 108], [RIGHT, 108]] },
  '7': {
    size: 24,
    spots: [[LEFT, 32], [RIGHT, 32], [MID, 51], [LEFT, 70], [RIGHT, 70], [LEFT, 108], [RIGHT, 108]],
  },
  '8': {
    size: 24,
    spots: [
      [LEFT, 32], [RIGHT, 32], [MID, 51], [LEFT, 70], [RIGHT, 70], [MID, 89], [LEFT, 108], [RIGHT, 108],
    ],
  },
  '9': {
    size: 22,
    spots: [
      [LEFT, 32], [RIGHT, 32], [LEFT, 57], [RIGHT, 57], [MID, 70], [LEFT, 83], [RIGHT, 83], [LEFT, 108], [RIGHT, 108],
    ],
  },
  T: {
    size: 22,
    spots: [
      [LEFT, 32], [RIGHT, 32], [MID, 44], [LEFT, 57], [RIGHT, 57], [LEFT, 83], [RIGHT, 83], [MID, 96], [LEFT, 108], [RIGHT, 108],
    ],
  },
};

function CardCenter({ rank, suit, color }: { rank: CardRank; suit: CardSuit; color: string }) {
  if (rank === 'A') return <Pip suit={suit} x={50} y={70} size={58} color={color} />;
  if (rank === 'K' || rank === 'Q' || rank === 'J') {
    return (
      <>
        <rect x="24" y="25" width="52" height="90" rx="7" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.6" />
        <rect x="29" y="30" width="42" height="80" rx="4" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1" />
        <Pip suit={suit} x={50} y={41} size={14} color={color} />
        <Pip suit={suit} x={50} y={99} size={14} color={color} flip />
        <text
          x="50"
          y="82"
          textAnchor="middle"
          fontSize="50"
          fontWeight="900"
          fill={color}
          style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}
        >
          {rank}
        </text>
      </>
    );
  }
  const layout = PIPS[rank];
  if (!layout) return null;
  return (
    <>
      {layout.spots.map(([x, y], index) => (
        <Pip key={index} suit={suit} x={x} y={y} size={layout.size} flip={y > 70} color={color} />
      ))}
    </>
  );
}

/**
 * A playing card in a four-colour deck. Size is the width in pixels; the height
 * follows the 5 : 7 proportion of a real card.
 */
export function PokerCard({
  code,
  width = 100,
  className,
  style,
}: {
  code: CardCode;
  width?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const parsed = parseCard(code);
  if (!parsed) return null;
  const { rank, suit } = parsed;
  const color = SUIT_COLORS[suit];
  const label = rankLabel(rank);

  return (
    <div
      role="img"
      aria-label={cardName(code)}
      className={className}
      style={{
        width,
        height: Math.round(width * 1.4),
        boxSizing: 'border-box',
        flexShrink: 0,
        borderRadius: Math.max(6, Math.round(width * 0.09)),
        border: '2px solid #E8C88A',
        background: 'linear-gradient(155deg, #FFFFFF 0%, #FBF3DF 58%, #F0DFB8 100%)',
        boxShadow: '0 8px 18px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.7)',
        ...style,
      }}
    >
      <svg viewBox="0 0 100 140" width="100%" height="100%" aria-hidden style={{ display: 'block' }}>
        <rect x="3" y="3" width="94" height="134" rx="6" fill="none" stroke={color} strokeOpacity="0.4" strokeWidth="1.2" />
        <g>
          <text
            x="13"
            y="25"
            textAnchor="middle"
            fontSize={label.length > 1 ? 17 : 22}
            fontWeight="900"
            fill={color}
            style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}
          >
            {label}
          </text>
          <Pip suit={suit} x={13} y={40} size={13} color={color} />
        </g>
        <g transform="rotate(180 50 70)">
          <text
            x="13"
            y="25"
            textAnchor="middle"
            fontSize={label.length > 1 ? 17 : 22}
            fontWeight="900"
            fill={color}
            style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}
          >
            {label}
          </text>
          <Pip suit={suit} x={13} y={40} size={13} color={color} />
        </g>
        <CardCenter rank={rank} suit={suit} color={color} />
      </svg>
    </div>
  );
}
