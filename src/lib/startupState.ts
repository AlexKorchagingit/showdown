export type StartupView = 'loading' | 'error' | 'ready';

export function resolveStartupView({
  showSplash,
  isLoading,
  hasAccount,
}: {
  showSplash: boolean;
  isLoading: boolean;
  hasAccount: boolean;
}): StartupView {
  if (showSplash || isLoading) return 'loading';
  return hasAccount ? 'ready' : 'error';
}
