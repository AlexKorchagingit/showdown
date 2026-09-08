import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawnSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
vi.mock('node:child_process', () => ({ spawnSync: mocks.spawnSync }));
vi.mock('node:fs', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs')>(),
  writeFileSync: mocks.writeFileSync,
  unlinkSync: mocks.unlinkSync,
}));
import { docker, localSql } from './security-local.mjs';

describe('isolated SQL runner (no Docker or network in these tests)', () => {
  beforeEach(() => {
    mocks.spawnSync.mockReset();
    mocks.writeFileSync.mockReset();
    mocks.unlinkSync.mockReset();
    mocks.spawnSync
      .mockReturnValueOnce({ status: 0, stdout: '' })
      .mockReturnValue({ status: 0, stdout: 'DO\n42\n' });
  });

  it('checks the synthetic marker before SQL in the same connection and stops on SQL errors', () => {
    expect(localSql('select 42;')).toBe('42');
    expect(mocks.spawnSync).toHaveBeenCalledTimes(2);
    expect(mocks.writeFileSync).toHaveBeenCalledTimes(1);
    expect(mocks.unlinkSync).toHaveBeenCalledTimes(1);

    const sql = mocks.writeFileSync.mock.calls[0][1] as string;
    const [command, args, options] = mocks.spawnSync.mock.calls[1];
    expect(command).toBe('docker');
    expect(args).toContain('ON_ERROR_STOP=1');
    expect(args).toContain('/tmp/showdown-security-local.sql');
    expect(options.stdio).toEqual(['ignore', 'pipe', 'pipe']);
    expect(sql).toContain("to_regclass('public.showdown_local_test_marker')");
    expect(sql).toContain('count(*) from public.showdown_local_test_marker');
    expect(sql).toContain('bool_and(id)');
    expect(sql).toContain("raise exception 'Refusing SQL: missing local test marker'");
    expect(sql.indexOf('end; $local_guard$;')).toBeLessThan(sql.indexOf('select 42;'));
  });

  it('pins the engine and the isolated local database container', () => {
    localSql('select 42;');
    const copyArgs: string[] = mocks.spawnSync.mock.calls[0][1];
    const args: string[] = mocks.spawnSync.mock.calls[1][1];
    expect(args[0]).toBe('--host');
    expect(args[1]).toBe(process.platform === 'win32'
      ? 'npipe:////./pipe/dockerDesktopLinuxEngine'
      : 'unix:///var/run/docker.sock');
    expect(copyArgs).toContain('showdown-security-local-db-1:/tmp/showdown-security-local.sql');
    expect(args).toContain('showdown-security-local-db-1');
    expect(args).toContain('postgres');
  });

  it('pins Compose commands to the synthetic project and its empty environment', () => {
    mocks.spawnSync.mockReset().mockReturnValue({ status: 0, stdout: '' });
    docker(['ps']);
    const args: string[] = mocks.spawnSync.mock.calls[0][1];
    expect(args[0]).toBe('--host');
    expect(args[1]).toBe(process.platform === 'win32'
      ? 'npipe:////./pipe/dockerDesktopLinuxEngine'
      : 'unix:///var/run/docker.sock');
    expect(args[args.indexOf('--project-name') + 1]).toBe('showdown-security-local');
    expect(args[args.indexOf('--env-file') + 1].replaceAll('\\', '/')).toMatch(/\/tests\/security\/compose\.env$/);
    expect(args[args.indexOf('-f') + 1].replaceAll('\\', '/')).toMatch(/\/tests\/security\/compose\.yml$/);
  });

  it.each(['DO\n42\n', 'DO\r\n42\r\n'])('removes only the initial guard tag with either line ending', (stdout) => {
    mocks.spawnSync
      .mockReset()
      .mockReturnValueOnce({ status: 0, stdout: '' })
      .mockReturnValue({ status: 0, stdout });
    expect(localSql('select 42;')).toBe('42');
  });

  it('supports SQL with no further output', () => {
    mocks.spawnSync
      .mockReset()
      .mockReturnValueOnce({ status: 0, stdout: '' })
      .mockReturnValue({ status: 0, stdout: 'DO\n' });
    expect(localSql('')).toBe('');
  });

  it('does not return an unconfirmed result', () => {
    mocks.spawnSync
      .mockReset()
      .mockReturnValueOnce({ status: 0, stdout: '' })
      .mockReturnValue({ status: 0, stdout: '42\n' });
    expect(() => localSql('select 42;')).toThrow('missing local guard confirmation');
  });

  it('does not retry or expose SQL/data on a failed marker check or SQL operation', () => {
    mocks.spawnSync
      .mockReset()
      .mockReturnValueOnce({ status: 0, stdout: '' })
      .mockReturnValue({ status: 1, stdout: '', stderr: 'synthetic-sensitive-error-detail' });
    expect(() => localSql('select 42;')).toThrow('Local Docker command failed; inspect only the local test services');
    expect(mocks.spawnSync).toHaveBeenCalledTimes(2);
  });
});
