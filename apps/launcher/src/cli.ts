import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { Context } from 'cordis';
import { launcherPlugin, startHost } from './index.js';
import { serveAssignments } from './assignments.js';
import { configure, identityFor, saveIdentity, settings } from './settings.js';

async function connect(command: 'register' | 'status' | 'connect', file?: string) {
  const context = new Context();
  await context.use(launcherPlugin);
  const { api } = settings();
  if (command === 'connect') {
    const stream = await context.launcher.connect(api, identityFor(api));
    console.log('Launcher online');
    return serveAssignments(stream, file);
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
} else if (command === 'start' && api && process.argv.length === 4) {
  const context = new Context();
  await context.use(launcherPlugin);
  const endpoints = settings();
  const provider = await context.launcher.status(endpoints.api, identityFor(endpoints.api));
  if (provider.state !== 'admitted') throw new Error('This launcher has not been admitted');
  console.log(JSON.stringify(await startHost(JSON.parse(readFileSync(api, 'utf8')))));
} else if (
  ((command === 'register' || command === 'status') && process.argv.length === 3) ||
  (command === 'connect' && !mcp)
) {
  await connect(command, api);
} else {
  throw new Error(
    'Use configure <api-url> <mcp-url>, register (code via stdin), status, connect [assignments.json], or start <assignment.json>',
  );
}
