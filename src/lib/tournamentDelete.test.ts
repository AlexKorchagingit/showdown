import { describe, expect, it } from 'vitest';
import { tournamentDeleteWarning } from './tournamentDelete';

describe('tournament delete confirmation copy', () => {
  it('warns that a closed event drops payments and points but keeps rubies', () => {
    const copy = tournamentDeleteWarning(true);
    expect(copy.title).toContain('закрытый');
    expect(copy.body).toContain('записи по оплатам');
    expect(copy.body).toContain('Очки по турниру у игроков будут удалены');
    expect(copy.body).toContain('рубины НЕ будут удалены');
  });

  it('uses a milder warning for an open event', () => {
    const copy = tournamentDeleteWarning(false);
    expect(copy.body).toContain('состав');
    expect(copy.body).not.toContain('рубины НЕ будут удалены');
  });
});
