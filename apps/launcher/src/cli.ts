import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { Context } from 'cordis';
import { launcherPlugin } from './index.js';
import { configure, identityFor, saveIdentity, settings } from './settings.js';

async function connect(command: 'register' | 'status' | 'connect') {
  const context = new Context();
  await context.use(launcherPlugin);
  const { api } = settings();
  if (command === 'connect') {
    const stream = await context.launcher.connect(api, identityFor(api));
    const reader = stream.getReader();
    console.log('Launcher online');
    while (!(await reader.read()).done) {
      // The connection remains active while the platform recognizes this launcher.
    }
    return;
  }
  if (command === 'status') {
    console.log(JSON.stringify(await context.launcher.status(api, identityFor(api))));
    return;
  }
  const code = readFileSync(0, 'utf8').trim();
  const identity = await context.launcher.enroll(
    api,
    code,
    hostname(),
    process.platform + '-' + process.arch,
  );
  saveIdentity(api, identity);
  console.log('Launcher pending admission: ' + identity.id);
}

const [command, api, mcp] = process.argv.slice(2);
if (command === 'configure' && api && mcp && process.argv.length === 5) {
  configure(api, mcp);
  console.log('Launcher endpoints configured');
} else if (
  (command === 'register' || command === 'status' || command === 'connect') &&
  process.argv.length === 3
) {
  await connect(command);
} else {
  throw new Error(
    'Use configure <api-url> <mcp-url>, register (code via stdin), status, or connect',
  );
}
