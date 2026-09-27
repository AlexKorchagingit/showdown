/** Insert a line break at the current selection. Used so Enter reaches a description. */
export function insertLineBreak(
  value: string,
  start: number,
  end: number,
): { value: string; caret: number } {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  return { value: `${value.slice(0, from)}\n${value.slice(to)}`, caret: from + 1 };
}
