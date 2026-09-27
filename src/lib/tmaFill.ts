import type { CSSProperties } from 'react';

/** Player-card / roster fill. Opaque plates composite over this, not over a UA gloss. */
export const TMA_CARD = '#2A211D';

const GREEN = '#22c55e';
const GOLD = '#D99962';
const RED = '#ef4444';
const WHITE = '#ffffff';

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`expected #rrggbb, got ${hex}`);
  }
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

/** Flatten a translucent overlay onto an opaque under-fill. Android WebView glosses rgba. */
export function blendOver(over: string, alpha: number, under = TMA_CARD): string {
  const top = parseHex(over);
  const bottom = parseHex(under);
  const mix = (a: number, b: number) => Math.round(a * alpha + b * (1 - alpha));
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(mix(top.r, bottom.r))}${hex(mix(top.g, bottom.g))}${hex(mix(top.b, bottom.b))}`;
}

const paidChip = blendOver(GREEN, 0.2);
const unpaidChip = blendOver(RED, 0.15);
const goldHit = blendOver(GOLD, 0.12);
const ticketHit = blendOver(GREEN, 0.12);
const idleHit = blendOver(WHITE, 0.06);

export const TMA_FILL = {
  card: TMA_CARD,
  arrivedRow: blendOver(GREEN, 0.28),
  pairingRow: blendOver(GOLD, 0.18),
  arrivedHit: blendOver(GREEN, 0.28),
  idleHit,
  arrivedBar: '#4ade80',
  arrivedHitBorder: '#4ade80',
  idleHitBorder: blendOver(WHITE, 0.12, idleHit),
  paidChip,
  unpaidChip,
  paidChipBorder: blendOver(GREEN, 0.5, paidChip),
  unpaidChipBorder: blendOver(RED, 0.5, unpaidChip),
  goldHit,
  goldHitBorder: blendOver(GOLD, 0.35, goldHit),
  ticketHit,
  ticketHitBorder: blendOver(GREEN, 0.35, ticketHit),
  goldText: '#F2D8A7',
  ticketText: '#86efac',
  paidText: '#4ade80',
  unpaidText: '#f87171',
  checkIdle: '#6B6360',
} as const;

/** Solid fill without shorthand `background` or inset shadows — those two-tone on Android. */
export function tmaPaint(backgroundColor: string, extra: CSSProperties = {}): CSSProperties {
  return {
    ...extra,
    backgroundColor,
    backgroundImage: 'none',
    boxShadow: 'none',
  };
}

export function lobbyArrivedRowStyle(opts: {
  idx: number;
  arrived: boolean;
  pairingThis: boolean;
}): CSSProperties {
  return tmaPaint(
    opts.pairingThis ? TMA_FILL.pairingRow : opts.arrived ? TMA_FILL.arrivedRow : TMA_FILL.card,
    {
      borderTop: opts.idx > 0 ? `1px solid ${blendOver(WHITE, 0.05)}` : 'none',
      borderLeft:
        opts.arrived && !opts.pairingThis
          ? `4px solid ${TMA_FILL.arrivedBar}`
          : '4px solid transparent',
    },
  );
}

export function lobbyArrivedHitStyle(arrived: boolean): CSSProperties {
  return tmaPaint(arrived ? TMA_FILL.arrivedHit : TMA_FILL.idleHit, {
    border: `1px solid ${arrived ? TMA_FILL.arrivedHitBorder : TMA_FILL.idleHitBorder}`,
  });
}

export const PAID_CHIP_STYLE = tmaPaint(TMA_FILL.paidChip, {
  color: TMA_FILL.paidText,
  border: `1px solid ${TMA_FILL.paidChipBorder}`,
});

export const UNPAID_CHIP_STYLE = tmaPaint(TMA_FILL.unpaidChip, {
  color: TMA_FILL.unpaidText,
  border: `1px solid ${TMA_FILL.unpaidChipBorder}`,
});

export const GOLD_HIT_STYLE = tmaPaint(TMA_FILL.goldHit, {
  color: TMA_FILL.goldText,
  border: `1px solid ${TMA_FILL.goldHitBorder}`,
});

export const TICKET_HIT_STYLE = tmaPaint(TMA_FILL.ticketHit, {
  color: TMA_FILL.ticketText,
  border: `1px solid ${TMA_FILL.ticketHitBorder}`,
});
