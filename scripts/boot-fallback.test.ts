import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

interface FakeElement {
  hidden?: boolean;
  onclick?: (() => void) | null;
  parentNode?: { removeChild: (element: FakeElement) => void };
  tagName?: string;
  textContent?: string;
}

function executeWatchdog() {
  const html = readFileSync('index.html', 'utf8');
  const source = html.match(/<script id="showdown-boot-watchdog">([\s\S]*?)<\/script>/)?.[1];
  if (!source) throw new Error('Boot watchdog source is missing');

  const removeChild = vi.fn();
  const reload = vi.fn();
  const clearTimeout = vi.fn();
  const listeners = new Map<string, (event: { target?: FakeElement }) => void>();
  const timeouts: Array<() => void> = [];
  const fallback: FakeElement = { hidden: true };
  fallback.parentNode = { removeChild };
  const message: FakeElement = { textContent: '' };
  const retry: FakeElement = { onclick: null };
  const elements: Record<string, FakeElement> = {
    'app-boot-fallback': fallback,
    'app-boot-fallback-message': message,
    'app-boot-retry': retry,
  };
  const windowObject: Record<string, unknown> = {
    location: { reload },
    clearTimeout,
    setTimeout: (callback: () => void) => {
      timeouts.push(callback);
      return 7;
    },
    addEventListener: (name: string, listener: (event: { target?: FakeElement }) => void) => {
      listeners.set(name, listener);
    },
  };

  runInNewContext(source, {
    document: { getElementById: (id: string) => elements[id] || null },
    window: windowObject,
  });

  return { clearTimeout, fallback, listeners, message, reload, removeChild, retry, timeouts, windowObject };
}

describe('pre-JavaScript boot fallback', () => {
  it('shows a recovery action when application startup times out', () => {
    const state = executeWatchdog();
    expect(state.timeouts).toHaveLength(1);

    state.timeouts[0]();

    expect(state.fallback.hidden).toBe(false);
    expect(state.message.textContent).toContain('Android System WebView');
    state.retry.onclick?.();
    expect(state.reload).toHaveBeenCalledOnce();
  });

  it('removes the fallback only after React reports a successful commit', () => {
    const state = executeWatchdog();
    const markReady = state.windowObject.__SHOWDOWN_APP_READY__ as () => void;

    markReady();

    expect(state.clearTimeout).toHaveBeenCalledWith(7);
    expect(state.removeChild).toHaveBeenCalledWith(state.fallback);
    expect(state.windowObject.__SHOWDOWN_APP_READY__).toBeNull();
  });

  it('shows the fallback immediately when a script resource cannot load', () => {
    const state = executeWatchdog();

    state.listeners.get('error')?.({ target: { tagName: 'SCRIPT' } });

    expect(state.fallback.hidden).toBe(false);
    expect(state.message.textContent).toContain('JavaScript');
  });
});
