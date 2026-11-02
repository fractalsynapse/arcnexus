import { execFileSync, spawnSync } from 'node:child_process';

if (!process.env.ARCNEXUS_TEST_CODEX)
  throw new Error('Native host qualification requires ARCNEXUS_TEST_CODEX');

const selection = JSON.parse(
  execFileSync(
    process.execPath,
    ['dist/cli.js', 'test', 'inspect', '--project', '.', '--tag', 'native-host', '--json'],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  ),
);

const suites = selection.suites.map((suite) => suite.compiled);

if (!suites.length) throw new Error('Native host qualification selected no suites');

const result = spawnSync(process.execPath, ['--test', ...suites], { stdio: 'inherit' });

if (result.error) throw result.error;

process.exitCode = result.status ?? 1;
