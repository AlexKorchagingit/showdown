/**
 * Vite rewrites the deploy base only for imported assets, so files referenced
 * from `public/` by path need the prefix applied by hand. Without it the app
 * breaks when served from a subdirectory such as GitHub Pages.
 */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
