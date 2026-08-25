/**
 * Public files in `public/` are addressed from the site root.
 * Strips a leftover GitHub Pages `/showdown/` prefix so stored URLs keep working.
 */
export function asset(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  return `/${trimmed.replace(/^\/+/, '').replace(/^showdown\//, '')}`;
}
