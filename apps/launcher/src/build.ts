import { execFile } from 'node:child_process';
import { chmod, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileDigest } from '../../../packages/foundation/src/index.js';
import { isLauncherTarget, launcherName, type LauncherTarget } from './targets.js';

const run = promisify(execFile);

/** Stage a compiled launcher and checksum together in the trusted download directory. */
async function packageLauncher(directory: string, target: LauncherTarget) {
  const staging = await mkdtemp(join(directory, '.build-'));
  try {
    const binary = join(staging, launcherName(target));
    await run('bun', [
      'build',
      '--compile',
      '--target=bun-' + target,
      'apps/launcher/src/cli.ts',
      '--outfile',
      binary,
    ]);
    const sha256 = await fileDigest(binary);
    await chmod(binary, 0o755);
    await writeFile(join(staging, 'sha256'), sha256 + '\n', { mode: 0o644, flag: 'wx' });
    await chmod(join(staging, 'sha256'), 0o644);
    await chmod(staging, 0o755);
    await rename(staging, join(directory, target));
    console.log(target + ' ' + sha256);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

const [directory, target, extra] = process.argv.slice(2);
if (!directory || !target || extra || !isLauncherTarget(target))
  throw new Error('Use build <artifact-directory> <linux-x64|linux-arm64>');
await packageLauncher(resolve(directory), target);
