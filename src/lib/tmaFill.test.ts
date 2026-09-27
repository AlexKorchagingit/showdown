import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  blendOver,
  GOLD_HIT_STYLE,
  lobbyArrivedHitStyle,
  lobbyArrivedRowStyle,
  PAID_CHIP_STYLE,
  TICKET_HIT_STYLE,
  TMA_CARD,
  TMA_FILL,
  UNPAID_CHIP_STYLE,
} from './tmaFill';

describe('tmaFill', () => {
  it('composites translucent greens onto the opaque card', () => {
    expect(blendOver('#22c55e', 0.28, TMA_CARD)).toBe('#284f2f');
    expect(TMA_FILL.arrivedRow).toBe('#284f2f');
    expect(TMA_FILL.arrivedHit).toBe('#284f2f');
    expect(TMA_FILL.paidChip).toBe('#28422a');
    expect(TMA_FILL.ticketHit).toBe('#293525');
    expect(TMA_FILL.goldHit).toBe('#3f2f25');
  });

  it('exports only opaque hex fills', () => {
    for (const [name, value] of Object.entries(TMA_FILL)) {
      expect(value, name).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('paints the lobby row as a solid fill plus a left bar, not an inset shadow', () => {
    const arrived = lobbyArrivedRowStyle({ idx: 1, arrived: true, pairingThis: false });
    expect(arrived.backgroundColor).toBe('#284f2f');
    expect(arrived.backgroundImage).toBe('none');
    expect(arrived.boxShadow).toBe('none');
    expect(arrived.borderLeft).toBe('4px solid #4ade80');
    expect(arrived.borderTop).toMatch(/^1px solid #/);

    const idle = lobbyArrivedRowStyle({ idx: 0, arrived: false, pairingThis: false });
    expect(idle.backgroundColor).toBe(TMA_CARD);
    expect(idle.borderLeft).toBe('4px solid transparent');
    expect(idle.borderTop).toBe('none');
  });

  it('paints the lobby check as a solid hit, arrived or idle', () => {
    expect(lobbyArrivedHitStyle(true).backgroundColor).toBe('#284f2f');
    expect(lobbyArrivedHitStyle(true).border).toBe('1px solid #4ade80');
    expect(lobbyArrivedHitStyle(false).backgroundColor).toBe(TMA_FILL.idleHit);
    expect(lobbyArrivedHitStyle(false).backgroundImage).toBe('none');
  });

  it('keeps cashier chips and charge plates on solid fills', () => {
    expect(PAID_CHIP_STYLE.backgroundColor).toBe(TMA_FILL.paidChip);
    expect(UNPAID_CHIP_STYLE.backgroundColor).toBe(TMA_FILL.unpaidChip);
    expect(GOLD_HIT_STYLE.backgroundColor).toBe(TMA_FILL.goldHit);
    expect(TICKET_HIT_STYLE.backgroundColor).toBe(TMA_FILL.ticketHit);
    for (const style of [PAID_CHIP_STYLE, UNPAID_CHIP_STYLE, GOLD_HIT_STYLE, TICKET_HIT_STYLE]) {
      expect(style.backgroundImage).toBe('none');
      expect(style.boxShadow).toBe('none');
      expect(style.backgroundClip).toBeUndefined();
    }
  });
});

describe('lobby and cashier screens', () => {
  const editor = readFileSync(resolve('src/pages/admin/AdminTournamentEditor.tsx'), 'utf8');
  const finance = readFileSync(resolve('src/pages/admin/AdminTournamentFinance.tsx'), 'utf8');
  const picker = readFileSync(resolve('src/components/admin/TournamentPlayerPicker.tsx'), 'utf8');

  it('do not use translucent green fills or inset bars', () => {
    expect(editor).not.toMatch(/rgba\(\s*34\s*,\s*197\s*,\s*94/);
    expect(finance).not.toMatch(/rgba\(\s*34\s*,\s*197\s*,\s*94/);
    expect(editor).not.toMatch(/inset 4px/);
    expect(finance).not.toMatch(/backgroundClip/);
    expect(finance).not.toMatch(/WebkitBackgroundClip/);
  });

  it('use opaque tokens and non-button hits on the two-tone plates', () => {
    expect(editor).toMatch(/lobbyArrivedRowStyle/);
    expect(editor).toMatch(/lobbyArrivedHitStyle/);
    expect(editor).toMatch(/<FlatHit/);
    expect(finance).toMatch(/PAID_CHIP_STYLE|UNPAID_CHIP_STYLE/);
    expect(finance).toMatch(/GOLD_HIT_STYLE/);
    expect(finance).toMatch(/TICKET_HIT_STYLE/);
    expect(finance).toMatch(/<FlatHit/);
  });

  it('paints the lobby add-player plate as an opaque non-button hit', () => {
    expect(picker).toMatch(/GOLD_HIT_STYLE/);
    expect(picker).not.toMatch(/background:\s*'rgba\(\s*217\s*,\s*153\s*,\s*98/);
    const addButton = picker.slice(picker.indexOf('export function AddTournamentPlayerButton'));
    expect(addButton).toMatch(/<FlatHit/);
    expect(addButton).not.toMatch(/<button/);
    expect(addButton).not.toMatch(/rgba\(/);
  });
});
