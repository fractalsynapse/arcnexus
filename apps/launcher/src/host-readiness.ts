import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { hostedReady } from '../../../packages/foundation/src/runtime-image.js';
import { docker } from './docker-host-image.js';

/** Report readiness only after the assigned container finishes its startup probes. */
export async function waitForHost(id: string) {
  const since = (await docker('inspect', '--format', '{{.State.StartedAt}}', id)).trim();
  const child = spawn('/usr/bin/docker', ['logs', '--follow', '--since', since, id], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const lines = createInterface({ input: child.stdout });
  try {
    for await (const line of lines) if (line === hostedReady) return;
    throw new Error('The assigned Host stopped before it became ready. See its Docker logs.');
  } finally {
    lines.close();
    child.kill();
  }
}
