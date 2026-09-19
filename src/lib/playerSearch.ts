/** Case-insensitive nickname / email match for the add-player directory. */
export function matchesPlayerSearch(
  user: { nickname: string; email?: string | null },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (user.nickname.toLowerCase().includes(needle)) return true;
  return (user.email ?? '').toLowerCase().includes(needle);
}
