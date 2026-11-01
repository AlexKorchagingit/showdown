export type CashierCommentState = {
  shown: string;
  draft: string | null;
  focused: boolean;
};

/**
 * The server trims the ends of a tournament comment. While the field is being
 * edited, that echo must not replace the draft or the caret jumps back to the
 * last word or the previous paragraph.
 */
export function applyServerComment(
  state: CashierCommentState,
  server: string,
  tournamentChanged: boolean,
): CashierCommentState {
  if (tournamentChanged) return { shown: server, draft: null, focused: false };
  if (state.focused) return state;
  if (state.draft == null) return { ...state, shown: server };
  if (server === state.draft || server === state.draft.trim()) {
    return { shown: server, draft: null, focused: false };
  }
  return state;
}
