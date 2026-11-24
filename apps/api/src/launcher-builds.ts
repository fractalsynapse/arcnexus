import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  isLauncherTarget,
  launcherName,
  launcherTargets,
  type LauncherTarget,
} from '../../launcher/src/targets.js';

async function artifact(directory: string | undefined, target: LauncherTarget) {
  if (!directory) return;
  const root = await realpath(directory);
  const file = join(root, target, launcherName(target));
  const sum = join(root, target, 'sha256');
  try {
    const stat = await lstat(file);
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      (await realpath(file)) !== file ||
      (await realpath(sum)) !== sum
    )
      return;
    const sha256 = (await readFile(sum, 'utf8')).trim();
    if (/^[a-f0-9]{64}$/.test(sha256)) return { file, target, sha256, length: stat.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function manifest(directory?: string) {
  const files = await Promise.all(
    Object.keys(launcherTargets)
      .filter(isLauncherTarget)
      .map((target) => artifact(directory, target)),
  );
  return Response.json({
    entries: files.flatMap((file) => (file ? [{ target: file.target, sha256: file.sha256 }] : [])),
  });
}

/** Serve only staged launcher executables and their public checksums from the trusted mount. */
export function launcherBuilds(directory?: string) {
  return async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (request.method !== 'GET') return new Response(null, { status: 405 });
    if (path === '/launcher-builds') return manifest(directory);
    const target = path.slice('/launcher-builds/'.length);
    if (!isLauncherTarget(target)) return new Response(null, { status: 404 });
    const found = await artifact(directory, target);
    if (!found) return new Response(null, { status: 404 });
    const body = Readable.toWeb(createReadStream(found.file)) as ReadableStream<
      Uint8Array<ArrayBuffer>
    >;
    return new Response(body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="' + launcherName(target) + '"',
        'Content-Length': String(found.length),
        'X-ArcNexus-SHA256': found.sha256,
      },
    });
  };
}
