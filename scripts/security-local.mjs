import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const host = process.platform === 'win32'
  ? 'npipe:////./pipe/dockerDesktopLinuxEngine' : 'unix:///var/run/docker.sock';
const compose = ['--host', host, 'compose', '--project-name', 'showdown-security-local',
  '--env-file', resolve(root, 'tests/security/compose.env'),
  '-f', resolve(root, 'tests/security/compose.yml')];

export function docker(args, input) {
  const result = spawnSync('docker', [...compose, ...args], {
    cwd: root, encoding: 'utf8', input, maxBuffer: 4 * 1024 * 1024,
    stdio: input === undefined ? 'inherit' : ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    // No environment dumps or raw SQL error details (may contain data).
    throw new Error('Local Docker command failed; inspect only the local test services');
  }
  return result.stdout?.trim() ?? '';
}

export function localSql(sql) {
  const marker = docker(['exec', '-T', 'db', 'psql', '-X', '-U', 'postgres', '-At',
    '-v', 'ON_ERROR_STOP=1', '-c', 'select id from public.showdown_local_test_marker'], '');
  if (marker !== 't') throw new Error('Refusing SQL: missing local test marker');
  return docker(['exec', '-T', 'db', 'psql', '-X', '-U', 'postgres', '-At',
    '-v', 'ON_ERROR_STOP=1'], sql);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = process.argv[2];
  if (action === 'up') docker(['up', '-d', '--wait', '--wait-timeout', '120']);
  else if (action === 'status') docker(['ps']);
  else if (action === 'stop') docker(['stop']);
  else if (action === 'schema') {
    localSql(readFileSync(resolve(root, 'tests/security/auth-helpers.sql'), 'utf8'));
    localSql(readFileSync(resolve(root, 'supabase/schema.sql'), 'utf8'));
    localSql(readFileSync(resolve(root, 'supabase/migrations/20260829_login_otp.sql'), 'utf8'));
    console.log('Local synthetic schema ready');
  } else throw new Error('Use up, status, schema or stop. No destructive reset command is provided.');
}
