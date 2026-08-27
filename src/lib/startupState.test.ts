import { describe, expect, it } from 'vitest';
import { resolveStartupView } from './startupState';

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
});
