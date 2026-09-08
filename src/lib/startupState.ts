export type StartupView = 'loading' | 'error' | 'ready';

export const STARTUP_TIMEOUT_MS = 10_000;

export type StartupStage =
  | 'session'
  | 'account'
  | 'application'
  | 'screen';

const STARTUP_STAGE_LABELS: Record<StartupStage, string> = {
  session: 'Восстанавливаем сессию…',
  account: 'Проверяем профиль…',
  application: 'Открываем приложение…',
  screen: 'Загружаем экран…',
};

export function startupStageLabel(stage: StartupStage): string {
  return STARTUP_STAGE_LABELS[stage];
}

export function resolveStartupView({
  showSplash,
  isLoading,
  hasAccount,
  timedOut = false,
}: {
  showSplash: boolean;
  isLoading: boolean;
  hasAccount: boolean;
  timedOut?: boolean;
}): StartupView {
  if (hasAccount && !showSplash) return 'ready';
  if (timedOut) return 'error';
  if (showSplash || isLoading) return 'loading';
  return 'error';
}
