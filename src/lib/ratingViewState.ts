export type RatingTab = 'general' | 'seasonal';
export type RatingMetricColumn = 'tournaments' | 'wins' | 'knockouts';

export type RatingViewState = {
  tab: RatingTab;
  month: number;
  column: RatingMetricColumn;
  scrollTop: number;
};

const STORAGE_KEY = 'showdown.rating-view';

const TABS = new Set<RatingTab>(['general', 'seasonal']);
const COLUMNS = new Set<RatingMetricColumn>(['tournaments', 'wins', 'knockouts']);

function defaultState(): RatingViewState {
  return {
    tab: 'general',
    month: new Date().getMonth(),
    column: 'tournaments',
    scrollTop: 0,
  };
}

let memory: RatingViewState = defaultState();

function storage(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

function sanitize(value: unknown): RatingViewState {
  const fallback = defaultState();
  if (!value || typeof value !== 'object') return fallback;
  const row = value as Partial<RatingViewState>;
  const month = Number(row.month);
  const scrollTop = Number(row.scrollTop);
  return {
    tab: TABS.has(row.tab as RatingTab) ? (row.tab as RatingTab) : fallback.tab,
    month: Number.isInteger(month) && month >= 0 && month <= 11 ? month : fallback.month,
    column: COLUMNS.has(row.column as RatingMetricColumn)
      ? (row.column as RatingMetricColumn)
      : fallback.column,
    scrollTop: Number.isFinite(scrollTop) && scrollTop > 0 ? scrollTop : 0,
  };
}

export function readRatingView(): RatingViewState {
  const store = storage();
  if (!store) return { ...memory };
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return { ...memory };
    memory = sanitize(JSON.parse(raw) as unknown);
    return { ...memory };
  } catch {
    return { ...memory };
  }
}

export function writeRatingView(patch: Partial<RatingViewState>): RatingViewState {
  memory = sanitize({ ...memory, ...patch });
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* private mode / quota */
  }
  return { ...memory };
}

/** Test helper: drop both memory and session snapshot. */
export function resetRatingView(): void {
  memory = defaultState();
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
