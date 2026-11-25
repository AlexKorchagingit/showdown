import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PokerCard } from './PokerCard';

describe('rank-only hand cards', () => {
  it('draws a large rank and no suit mark', () => {
    const html = renderToStaticMarkup(<PokerCard code="Ah" rankOnly width={88} />);
    expect(html).toContain('>A<');
    expect(html).toContain('font-size="78"');
    expect(html).not.toContain('<path');
    expect(html).not.toContain('<circle');
    expect(html).toContain('width:88px');
  });

  it('keeps ten as two digits inside the same frame', () => {
    const html = renderToStaticMarkup(<PokerCard code="Td" rankOnly width={88} />);
    expect(html).toContain('>10<');
    expect(html).toContain('font-size="54"');
    expect(html).not.toContain('<path');
  });
});
