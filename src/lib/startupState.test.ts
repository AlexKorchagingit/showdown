import { describe, expect, it } from 'vitest';
import {
  resolveStartupView,
  STARTUP_TIMEOUT_MS,
  startupStageLabel,
} from './startupState';

describe('resolveStartupView', () => {
  it('keeps the splash while its minimum display time is active', () => {
    expect(resolveStartupView({ showSplash: true, isLoading: false, hasAccount: true })).toBe('loading');
  });

  it('keeps loading while the account request is active', () => {
    expect(resolveStartupView({ showSplash: false, isLoading: true, hasAccount: false })).toBe('loading');
  });

  it('shows a connection error instead of an endless splash when no account was loaded', () => {
    expect(resolveStartupView({ showSplash: false, isLoading: false, hasAccount: false })).toBe('error');
  });

  it('shows the application after the account is loaded', () => {
    expect(resolveStartupView({ showSplash: false, isLoading: false, hasAccount: true })).toBe('ready');
  });

  it('keeps the loaded application visible during a background refresh', () => {
    expect(resolveStartupView({ showSplash: false, isLoading: true, hasAccount: true })).toBe('ready');
  });

  it('stops an unfinished startup after the common deadline', () => {
    expect(STARTUP_TIMEOUT_MS).toBe(10_000);
    expect(resolveStartupView({
      showSplash: true,
      isLoading: true,
      hasAccount: false,
      timedOut: true,
    })).toBe('error');
  });

  it('does not hide an account that finished while the timeout fired', () => {
    expect(resolveStartupView({
      showSplash: false,
      isLoading: false,
      hasAccount: true,
      timedOut: true,
    })).toBe('ready');
  });

  it('provides a visible label for every startup stage', () => {
    expect(startupStageLabel('session')).toBe('Восстанавливаем сессию…');
    expect(startupStageLabel('account')).toBe('Проверяем профиль…');
    expect(startupStageLabel('application')).toBe('Открываем приложение…');
    expect(startupStageLabel('screen')).toBe('Загружаем экран…');
  });
});
