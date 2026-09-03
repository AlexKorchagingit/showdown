import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ spawnSync: vi.fn() }));
vi.mock('node:child_process', () => ({ spawnSync: mocks.spawnSync }));
import { localSql } from './security-local.mjs';

describe('isolated SQL runner (no Docker or network in these tests)', () => {
  beforeEach(() => {
    mocks.spawnSync.mockReset();
    mocks.spawnSync.mockReturnValue({ status: 0, stdout: 'DO\n42\n' });
  });
  it('checks the synthetic marker before SQL in the same connection and stops on SQL errors', () => {
    expect(localSql('select 42;')).toBe('42');
    expect(mocks.spawnSync).toHaveBeenCalledTimes(1);
    const [command, args, options] = mocks.spawnSync.mock.calls[0];
    expect(command).toBe('docker');
    expect(args).toContain('ON_ERROR_STOP=1');
    expect(options.input).toContain("to_regclass('public.showdown_local_test_marker')");
    expect(options.input).toContain('count(*) from public.showdown_local_test_marker');
    expect(options.input).toContain('bool_and(id)');
    expect(options.input).toContain("raise exception 'Refusing SQL: missing local test marker'");
    expect(options.input.indexOf('end; $local_guard$;')).toBeLessThan(options.input.indexOf('select 42;'));
  });
  it('pins the engine, compose project and empty environment file', () => {
    localSql('select 42;');
    const args: string[] = mocks.spawnSync.mock.calls[0][1];
    expect(args[0]).toBe('--host');
    expect(args[1]).toBe(process.platform === 'win32' ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock');
    expect(args[args.indexOf('--project-name') + 1]).toBe('showdown-security-local');
    expect(args[args.indexOf('--env-file') + 1].replaceAll('\\', '/')).toMatch(/\/tests\/security\/compose\.env$/);
    expect(args[args.indexOf('-f') + 1].replaceAll('\\', '/')).toMatch(/\/tests\/security\/compose\.yml$/);
    expect(args).toContain('postgres');
  });
  it.each(['DO\n42\n', 'DO\r\n42\r\n'])('removes only the initial guard tag with either line ending', (stdout) => {
    mocks.spawnSync.mockReturnValue({ status: 0, stdout });
    expect(localSql('select 42;')).toBe('42');
  });
  it('supports SQL with no further output', () => {
    mocks.spawnSync.mockReturnValue({ status: 0, stdout: 'DO\n' });
    expect(localSql('')).toBe('');
  });
  it('does not return an unconfirmed result', () => {
    mocks.spawnSync.mockReturnValue({ status: 0, stdout: '42\n' });
    expect(() => localSql('select 42;')).toThrow('missing local guard confirmation');
  });
  it('does not retry or expose SQL/data on a failed marker check or SQL operation', () => {
    mocks.spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'synthetic-sensitive-error-detail' });
    expect(() => localSql('select 42;')).toThrow('Local Docker command failed; inspect only the local test services');
    expect(mocks.spawnSync).toHaveBeenCalledTimes(1);
  });
});
