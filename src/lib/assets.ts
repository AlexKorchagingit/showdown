/**
 * Public files in `public/` are addressed from Vite `base`
 * (`/` on showdown-br.ru, `/showdown/` on GitHub Pages).
 * Strips a leftover GitHub Pages `/showdown/` prefix so stored URLs keep working.
 */
export function asset(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  const clean = trimmed.replace(/^\/+/, '').replace(/^showdown\//, '');
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${clean}`;
}
