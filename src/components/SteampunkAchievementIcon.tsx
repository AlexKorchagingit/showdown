/** Steampunk badge art for achievement cards — keyed by achievement id. */

import { createContext, useContext, useId, type ReactNode } from 'react';

interface Props {
  id: string;
  className?: string;
}

interface SpTheme {
  id: (name: string) => string;
  url: (name: string) => string;
}

const SpCtx = createContext<SpTheme>({
  id: (n) => n,
  url: (n) => `url(#${n})`,
});

function useSp() {
  return useContext(SpCtx);
}

function Defs({ uid }: { uid: string }) {
  const id = (name: string) => `${uid}-${name}`;
  return (
    <defs>
      <linearGradient id={id('copper')} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F2D8A7" />
        <stop offset="45%" stopColor="#D99962" />
        <stop offset="100%" stopColor="#8C4C27" />
      </linearGradient>
      <linearGradient id={id('gold')} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#8C4C27" />
        <stop offset="50%" stopColor="#F2D8A7" />
        <stop offset="100%" stopColor="#D99962" />
      </linearGradient>
      <linearGradient id={id('ruby')} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#E8A0A8" />
        <stop offset="55%" stopColor="#C23B4A" />
        <stop offset="100%" stopColor="#6B1520" />
      </linearGradient>
      <radialGradient id={id('glow')} cx="50%" cy="40%" r="55%">
        <stop offset="0%" stopColor="#F2D8A7" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#231A16" stopOpacity="0" />
      </radialGradient>
      <filter id={id('shade')} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="#000" floodOpacity="0.55" />
      </filter>
    </defs>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { url } = useSp();
  return (
    <g filter={url('shade')}>
      <circle cx="32" cy="32" r="30" fill={url('glow')} />
      <circle cx="32" cy="32" r="29" fill="#1A1210" stroke={url('copper')} strokeWidth="1.6" />
      <circle cx="32" cy="32" r="26.5" fill="none" stroke="#463129" strokeWidth="0.8" opacity="0.9" />
      {[
        [8, 18],
        [56, 18],
        [8, 46],
        [56, 46],
        [32, 6],
        [32, 58],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.4" fill={url('gold')} stroke="#5A3420" strokeWidth="0.4" />
      ))}
      {children}
    </g>
  );
}

function Gear({
  cx,
  cy,
  r = 6,
  teeth = 8,
  fill,
}: {
  cx: number;
  cy: number;
  r?: number;
  teeth?: number;
  fill?: string;
}) {
  const { url } = useSp();
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (Math.PI * i) / teeth;
    const rr = i % 2 === 0 ? r : r * 0.72;
    pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
  }
  return (
    <g>
      <polygon points={pts.join(' ')} fill={fill ?? url('copper')} stroke="#5A3420" strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={r * 0.28} fill="#231A16" stroke="#F2D8A7" strokeWidth="0.6" />
    </g>
  );
}

function IconFish() {
  const { url } = useSp();
  return (
    <Frame>
      <ellipse cx="30" cy="33" rx="14" ry="8" fill={url('copper')} stroke="#5A3420" strokeWidth="0.7" />
      <path d="M42 33 L54 26 L50 33 L54 40 Z" fill={url('gold')} stroke="#5A3420" strokeWidth="0.6" />
      <path d="M20 27 Q24 22 30 24" fill="none" stroke="#F2D8A7" strokeWidth="0.8" opacity="0.7" />
      <circle cx="22" cy="31" r="1.6" fill="#231A16" />
      <circle cx="22.4" cy="30.6" r="0.5" fill="#F2D8A7" />
      {[26, 32, 38].map((x) => (
        <circle key={x} cx={x} cy="35" r="1.1" fill="#8C4C27" stroke="#F2D8A7" strokeWidth="0.35" />
      ))}
      <Gear cx={44} cy={20} r={5} teeth={7} />
      <path d="M16 38 Q22 42 28 40" fill="none" stroke="#8C4C27" strokeWidth="1.2" strokeLinecap="round" />
    </Frame>
  );
}

function IconCrucian() {
  const { url } = useSp();
  return (
    <Frame>
      <ellipse cx="31" cy="34" rx="16" ry="10.5" fill={url('gold')} stroke="#5A3420" strokeWidth="0.8" />
      <ellipse cx="31" cy="34" rx="12" ry="7.5" fill="none" stroke="#8C4C27" strokeWidth="0.6" opacity="0.7" />
      <path d="M45 34 L57 25 L52 34 L57 43 Z" fill={url('copper')} stroke="#5A3420" strokeWidth="0.6" />
      <path d="M24 26 Q31 20 40 25" fill="none" stroke="#F2D8A7" strokeWidth="1" />
      <path d="M18 36 Q10 40 8 44" fill="none" stroke="#D99962" strokeWidth="0.9" />
      <path d="M18 32 Q10 28 8 24" fill="none" stroke="#D99962" strokeWidth="0.9" />
      <circle cx="20" cy="32" r="2" fill="#231A16" />
      <circle cx="20.6" cy="31.4" r="0.6" fill="#F2D8A7" />
      <path d="M22 40 Q31 44 40 40" fill="none" stroke="#463129" strokeWidth="1.4" />
      {[24, 30, 36].map((x) => (
        <rect
          key={x}
          x={x - 2}
          y="32"
          width="4"
          height="3.5"
          rx="0.6"
          fill="#8C4C27"
          stroke="#F2D8A7"
          strokeWidth="0.35"
        />
      ))}
      <Gear cx={48} cy={18} r={5.5} teeth={8} />
    </Frame>
  );
}

function IconShark() {
  const { url } = useSp();
  return (
    <Frame>
      <path
        d="M10 34 L28 24 L48 28 L58 34 L48 40 L28 44 Z"
        fill={url('copper')}
        stroke="#5A3420"
        strokeWidth="0.7"
      />
      <path d="M48 28 L58 22 L56 34" fill={url('gold')} stroke="#5A3420" strokeWidth="0.5" />
      <path d="M30 24 L34 14 L38 24" fill={url('gold')} stroke="#5A3420" strokeWidth="0.5" />
      <circle cx="20" cy="32" r="1.8" fill="#231A16" />
      <path d="M14 36 L22 38 L14 39" fill="#231A16" />
      <Gear cx={40} cy={34} r={4.5} teeth={6} />
    </Frame>
  );
}

function IconMegalodon() {
  const { url } = useSp();
  return (
    <Frame>
      <path
        d="M8 36 L24 22 L44 26 L60 34 L44 42 L24 48 Z"
        fill={url('gold')}
        stroke="#5A3420"
        strokeWidth="0.8"
      />
      <path d="M44 26 L58 16 L56 34" fill={url('copper')} />
      {[16, 20, 24, 28].map((x) => (
        <path
          key={x}
          d={`M${x} 38 L${x + 2} 44 L${x + 4} 38`}
          fill="#F2D8A7"
          stroke="#5A3420"
          strokeWidth="0.3"
        />
      ))}
      <circle cx="18" cy="30" r="2.2" fill="#231A16" />
      <circle cx="18.7" cy="29.3" r="0.7" fill="#C23B4A" />
      <Gear cx={36} cy={16} r={6} teeth={9} />
      <Gear cx={50} cy={44} r={4.5} teeth={7} />
    </Frame>
  );
}

function IconRoyalFlush() {
  const { url } = useSp();
  return (
    <Frame>
      <g transform="rotate(-18 32 36)">
        <rect x="18" y="18" width="16" height="22" rx="1.5" fill="#2A1C16" stroke={url('copper')} strokeWidth="1" />
        <text x="26" y="30" textAnchor="middle" fill={url('ruby')} fontSize="9" fontWeight="700" fontFamily="serif">
          A
        </text>
        <path d="M26 34 L28 38 L26 42 L24 38 Z" fill={url('ruby')} />
      </g>
      <g transform="rotate(0 32 36)">
        <rect x="24" y="16" width="16" height="22" rx="1.5" fill="#2A1C16" stroke={url('gold')} strokeWidth="1.1" />
        <text x="32" y="28" textAnchor="middle" fill={url('gold')} fontSize="9" fontWeight="700" fontFamily="serif">
          K
        </text>
        <path d="M32 32 L34 36 L32 40 L30 36 Z" fill={url('copper')} />
      </g>
      <g transform="rotate(18 32 36)">
        <rect x="30" y="18" width="16" height="22" rx="1.5" fill="#2A1C16" stroke={url('copper')} strokeWidth="1" />
        <text x="38" y="30" textAnchor="middle" fill={url('ruby')} fontSize="8" fontWeight="700" fontFamily="serif">
          Q
        </text>
      </g>
      <path
        d="M22 12 L26 8 L32 12 L38 8 L42 12 L40 16 L24 16 Z"
        fill={url('gold')}
        stroke="#5A3420"
        strokeWidth="0.5"
      />
      <Gear cx={50} cy={48} r={5} teeth={7} />
    </Frame>
  );
}

function IconStraightFlush() {
  const { url } = useSp();
  return (
    <Frame>
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${10 + i * 8} ${20 + i * 2}) rotate(${-12 + i * 8})`}>
          <rect width="12" height="18" rx="1.2" fill="#2A1C16" stroke={url('copper')} strokeWidth="0.8" />
          <text x="6" y="12" textAnchor="middle" fill={url('gold')} fontSize="7" fontWeight="700">
            {10 + i}
          </text>
        </g>
      ))}
      <path d="M14 48 Q32 40 50 48" fill="none" stroke={url('gold')} strokeWidth="1.4" />
      <Gear cx={48} cy={14} r={5} teeth={8} />
    </Frame>
  );
}

function IconQuads() {
  const { url } = useSp();
  return (
    <Frame>
      {[
        [16, 16],
        [34, 16],
        [16, 34],
        [34, 34],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="14" height="14" rx="1.5" fill="#2A1C16" stroke={url('gold')} strokeWidth="0.9" />
          <text
            x={x + 7}
            y={y + 10}
            textAnchor="middle"
            fill={url('copper')}
            fontSize="8"
            fontWeight="800"
            fontFamily="serif"
          >
            K
          </text>
        </g>
      ))}
    </Frame>
  );
}

function IconCrown() {
  const { url } = useSp();
  return (
    <Frame>
      <path
        d="M14 40 L18 22 L26 32 L32 16 L38 32 L46 22 L50 40 Z"
        fill={url('gold')}
        stroke="#5A3420"
        strokeWidth="0.8"
      />
      <rect x="14" y="40" width="36" height="6" rx="1" fill={url('copper')} stroke="#5A3420" strokeWidth="0.5" />
      {[18, 32, 46].map((x) => (
        <circle key={x} cx={x} cy="20" r="2.2" fill={url('ruby')} stroke="#F2D8A7" strokeWidth="0.4" />
      ))}
      <Gear cx={50} cy={48} r={4.5} teeth={6} />
    </Frame>
  );
}

function IconWelcome() {
  const { url } = useSp();
  return (
    <Frame>
      <path
        d="M20 38 V24 Q20 16 32 16 Q44 16 44 24 V38"
        fill="none"
        stroke={url('copper')}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="16" r="3" fill={url('gold')} />
      <path d="M24 38 H40" stroke={url('gold')} strokeWidth="2" strokeLinecap="round" />
      <Gear cx={48} cy={44} r={5} teeth={7} />
      <path
        d="M16 28 L12 24 M16 32 L10 32 M16 36 L12 40"
        stroke="#D99962"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </Frame>
  );
}

function IconBounty() {
  const { url } = useSp();
  return (
    <Frame>
      <circle cx="32" cy="30" r="12" fill="none" stroke={url('copper')} strokeWidth="2" />
      <circle cx="32" cy="30" r="6" fill="none" stroke={url('gold')} strokeWidth="1.4" />
      <circle cx="32" cy="30" r="2" fill={url('ruby')} />
      <path
        d="M32 18 V12 M32 42 V48 M18 30 H12 M46 30 H52"
        stroke="#D99962"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Gear cx={48} cy={48} r={4} teeth={6} />
    </Frame>
  );
}

function IconPredator() {
  const { url } = useSp();
  return (
    <Frame>
      <path d="M18 44 Q22 20 32 14 Q42 20 46 44" fill={url('copper')} stroke="#5A3420" strokeWidth="0.7" />
      <path d="M24 28 L32 18 L40 28" fill={url('gold')} opacity="0.85" />
      <path d="M26 40 L32 28 L38 40" fill="#8C4C27" />
      <Gear cx={46} cy={18} r={5} teeth={7} />
    </Frame>
  );
}

function IconHunter() {
  const { url } = useSp();
  return (
    <Frame>
      <path
        d="M18 40 L32 14 L46 40 Z"
        fill="none"
        stroke={url('copper')}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M24 36 L32 22 L40 36" fill={url('gold')} opacity="0.5" />
      <circle cx="32" cy="30" r="3" fill={url('ruby')} />
      <path d="M32 14 V8" stroke="#F2D8A7" strokeWidth="1.4" />
      <Gear cx={48} cy={46} r={4.5} teeth={6} />
    </Frame>
  );
}

function IconWinner() {
  const { url } = useSp();
  return (
    <Frame>
      <path
        d="M22 18 H42 V28 Q42 38 32 42 Q22 38 22 28 Z"
        fill={url('gold')}
        stroke="#5A3420"
        strokeWidth="0.8"
      />
      <rect x="28" y="42" width="8" height="6" fill={url('copper')} />
      <rect x="22" y="48" width="20" height="4" rx="1" fill={url('copper')} />
      <circle cx="32" cy="28" r="4" fill="#231A16" stroke="#F2D8A7" strokeWidth="0.8" />
      <text x="32" y="30.5" textAnchor="middle" fill={url('gold')} fontSize="6" fontWeight="800">
        1
      </text>
    </Frame>
  );
}

function IconRanked() {
  const { url } = useSp();
  return (
    <Frame>
      <circle cx="32" cy="30" r="14" fill={url('copper')} stroke="#5A3420" strokeWidth="0.8" />
      <circle cx="32" cy="30" r="10" fill="#231A16" stroke={url('gold')} strokeWidth="1" />
      <text x="32" y="34" textAnchor="middle" fill={url('gold')} fontSize="11" fontWeight="800">
        27
      </text>
      <path d="M20 48 H44" stroke={url('copper')} strokeWidth="2" strokeLinecap="round" />
    </Frame>
  );
}

function IconFinalist() {
  const { url } = useSp();
  return (
    <Frame>
      <path d="M16 40 L32 12 L48 40 Z" fill={url('copper')} stroke="#5A3420" strokeWidth="0.7" />
      <path d="M24 40 L32 24 L40 40" fill={url('gold')} opacity="0.55" />
      <rect x="20" y="40" width="24" height="5" rx="1" fill={url('gold')} />
      <text x="32" y="36" textAnchor="middle" fill="#231A16" fontSize="8" fontWeight="800">
        9
      </text>
    </Frame>
  );
}

function IconPhoto() {
  const { url } = useSp();
  return (
    <Frame>
      <rect x="14" y="22" width="36" height="26" rx="3" fill={url('copper')} stroke="#5A3420" strokeWidth="0.8" />
      <circle cx="32" cy="35" r="8" fill="#231A16" stroke={url('gold')} strokeWidth="1.2" />
      <circle cx="32" cy="35" r="4" fill={url('gold')} opacity="0.35" />
      <rect x="24" y="16" width="16" height="6" rx="1" fill={url('gold')} />
      <circle cx="42" cy="28" r="2" fill={url('ruby')} />
      <path d="M18 18 L22 14 M46 18 L42 14" stroke="#F2D8A7" strokeWidth="1.2" strokeLinecap="round" />
    </Frame>
  );
}

function IconBubble() {
  const { url } = useSp();
  return (
    <Frame>
      <circle cx="32" cy="30" r="12" fill="none" stroke={url('copper')} strokeWidth="1.6" strokeDasharray="3 2" />
      <circle cx="32" cy="30" r="7" fill={url('gold')} opacity="0.25" stroke={url('gold')} strokeWidth="1" />
      <text x="32" y="34" textAnchor="middle" fill={url('copper')} fontSize="10" fontWeight="800">
        $
      </text>
      <path d="M20 46 Q32 50 44 46" fill="none" stroke="#8C4C27" strokeWidth="1.4" />
      <Gear cx={48} cy={16} r={4.5} teeth={6} />
    </Frame>
  );
}

function IconFriend() {
  const { url } = useSp();
  return (
    <Frame>
      <circle cx="24" cy="26" r="7" fill={url('copper')} stroke="#5A3420" strokeWidth="0.6" />
      <circle cx="40" cy="26" r="7" fill={url('gold')} stroke="#5A3420" strokeWidth="0.6" />
      <path
        d="M14 44 Q24 34 32 38 Q40 34 50 44"
        fill={url('copper')}
        opacity="0.85"
        stroke="#5A3420"
        strokeWidth="0.5"
      />
      <Gear cx={48} cy={48} r={4} teeth={6} />
    </Frame>
  );
}

function IconResident() {
  const { url } = useSp();
  return (
    <Frame>
      <path d="M12 36 L32 16 L52 36" fill="none" stroke={url('gold')} strokeWidth="2" strokeLinejoin="round" />
      <rect x="20" y="36" width="24" height="14" fill={url('copper')} stroke="#5A3420" strokeWidth="0.6" />
      <rect x="28" y="40" width="8" height="10" fill="#231A16" stroke="#F2D8A7" strokeWidth="0.5" />
      <circle cx="32" cy="28" r="2.5" fill={url('ruby')} />
      <Gear cx={48} cy={20} r={4.5} teeth={7} />
    </Frame>
  );
}

function IconPunctual() {
  const { url } = useSp();
  return (
    <Frame>
      <circle cx="32" cy="32" r="14" fill="#231A16" stroke={url('copper')} strokeWidth="2" />
      <circle cx="32" cy="32" r="11" fill="none" stroke={url('gold')} strokeWidth="0.8" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={32 + Math.cos(a) * 9}
            y1={32 + Math.sin(a) * 9}
            x2={32 + Math.cos(a) * 11}
            y2={32 + Math.sin(a) * 11}
            stroke="#D99962"
            strokeWidth="1"
          />
        );
      })}
      <line x1="32" y1="32" x2="32" y2="22" stroke={url('gold')} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="32" y1="32" x2="40" y2="36" stroke={url('copper')} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="1.6" fill="#F2D8A7" />
    </Frame>
  );
}

function IconGiantSlayer() {
  const { url } = useSp();
  return (
    <Frame>
      <path d="M28 14 L36 14 L34 36 L30 36 Z" fill={url('copper')} stroke="#5A3420" strokeWidth="0.5" />
      <path d="M22 14 H42 L38 20 H26 Z" fill={url('gold')} stroke="#5A3420" strokeWidth="0.5" />
      <circle cx="32" cy="42" r="8" fill="#231A16" stroke={url('ruby')} strokeWidth="1.4" />
      <path d="M28 42 L32 38 L36 42 L32 46 Z" fill={url('ruby')} />
      <Gear cx={48} cy={48} r={4.5} teeth={6} />
    </Frame>
  );
}

const BY_ID: Record<string, () => ReactNode> = {
  fish: IconFish,
  crucian: IconCrucian,
  shark: IconShark,
  megalodon: IconMegalodon,
  welcome: IconWelcome,
  'the-best': IconCrown,
  'bounty-king': IconBounty,
  predator: IconPredator,
  headhunter: IconHunter,
  winner: IconWinner,
  'royal-flush': IconRoyalFlush,
  'straight-flush': IconStraightFlush,
  'four-kings': IconQuads,
  'in-the-clip': IconRanked,
  finalist: IconFinalist,
  paparazzi: IconPhoto,
  bubble: IconBubble,
  friend: IconFriend,
  resident: IconResident,
  punctual: IconPunctual,
  'giant-slayer': IconGiantSlayer,
};

export function SteampunkAchievementIcon({ id, className = '' }: Props) {
  const rawId = useId().replace(/:/g, '');
  const theme: SpTheme = {
    id: (name) => `${rawId}-${name}`,
    url: (name) => `url(#${rawId}-${name})`,
  };
  const render = BY_ID[id] ?? IconWelcome;

  return (
    <SpCtx.Provider value={theme}>
      <svg
        viewBox="0 0 64 64"
        className={`drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${className}`}
        aria-hidden
      >
        <Defs uid={rawId} />
        {render()}
      </svg>
    </SpCtx.Provider>
  );
}
