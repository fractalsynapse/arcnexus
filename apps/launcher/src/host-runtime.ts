import { execFileSync } from 'node:child_process';
import {
  constants,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { textDigest } from '../../../packages/foundation/src/index.js';
import { hostAssignmentSchema, type HostAssignment } from './host-assignment.js';
import { docker, verifyHostImage } from './docker-host-image.js';
import { hostPolicyIdentity, matchesHostPolicy, withHostPolicy } from './host-policy.js';
import { provisionHostCheckout } from './host-workspace.js';
import { waitForHost } from './host-readiness.js';

const checkout = '/var/lib/arcnexus/repository';
const storage = '/var/lib/arcnexus/state';
const credential = '/run/arcnexus/credential';
const assignment = '/run/arcnexus/assignment.json';
const database = '/run/arcnexus/database';
const githubKey = '/run/arcnexus/github-app.pem';

function regularPath(path: string, directory: boolean) {
  const stat = lstatSync(path);
  if (
    realpathSync(path) !== path ||
    (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1)
  )
    throw new Error('Hosted path must be a direct local ' + (directory ? 'directory' : 'file'));
  return stat;
}

function credentials(config: HostAssignment) {
  mkdirSync(config.credentials, { recursive: true, mode: 0o700 });
  if (regularPath(config.credentials, true).mode & 0o077)
    throw new Error('Codex credential storage requires private directory permissions');
  if (!config.seedCredentials) return;
  const source = regularPath(config.seedCredentials, false);
  if (source.mode & 0o077) throw new Error('Codex credential source must be private');
  const target = join(config.credentials, 'auth.json');
  try {
    copyFileSync(config.seedCredentials, target, constants.COPYFILE_EXCL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  if (regularPath(target, false).mode & 0o077)
    throw new Error('Codex credential destination must be private');
}

function verifyCheckout(config: HostAssignment) {
  regularPath(config.checkout, true);
  const git = (...args: string[]) =>
    execFileSync('/usr/bin/git', args, {
      cwd: config.checkout,
      encoding: 'utf8',
      maxBuffer: Infinity,
    }).trim();
  if (
    git('config', '--get', 'remote.origin.url') !== config.remote ||
    git('rev-parse', 'HEAD') !== config.revision
  )
    throw new Error('The managed checkout differs from its captured project binding');
}

function prepare(config: HostAssignment) {
  mkdirSync(config.storage, { recursive: true, mode: 0o700 });
  regularPath(config.storage, true);
  if (regularPath(config.database, false).mode & 0o077)
    throw new Error('Hosted database credential must be private');
  provisionHostCheckout(config, (directory) => regularPath(directory, true));
  verifyCheckout(config);
  credentials(config);
  if (config.github && regularPath(config.github.privateKeyFile, false).mode & 0o077)
    throw new Error('Hosted GitHub App credential must be private');
  return writeAssignment(config);
}

/** Persist the credential reference and exact source and runtime across Host replacement. */
function writeAssignment(config: HostAssignment) {
  const runtime = { image: config.image.approvedImage, base: config.image.base };
  const file = join(
    config.storage,
    'host-assignment-' +
      textDigest(JSON.stringify([config.revision, runtime, config.documentationOnly])) +
      '.json',
  );
  const value = JSON.stringify({
    remote: config.remote,
    revision: config.revision,
    directory: checkout,
    documentationOnly: config.documentationOnly,
    storage,
    runtime,
    githubAppId: config.github?.appId,
  });
  try {
    writeFileSync(file, value, { mode: 0o600, flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    regularPath(file, false);
    if (readFileSync(file, 'utf8') !== value)
      throw new Error('The prior Host assignment differs', { cause: error });
  }
  return file;
}

function mount(source: string, target: string, readOnly = false) {
  return [
    '--mount',
    'type=bind,source=' + source + ',target=' + target + (readOnly ? ',readonly' : ''),
  ];
}

function containerArguments(config: HostAssignment, file: string, name: string, binding: string) {
  return [
    '--name',
    name,
    '--network',
    config.network,
    ...(config.egress ? ['--network', 'name=' + config.egress + ',gw-priority=1'] : []),
    '--label',
    'io.arcnexus.assignment=' + binding,
    '--env',
    'ARC_ISOLATED_REVIEW=1',
    '--env',
    'ARC_HOST_WORKER=' + name,
    '--env',
    'ARC_HOST_ASSIGNMENT_FILE=' + assignment,
    '--env',
    'ARC_HOST_DATABASE_URL_FILE=' + database,
    '--env',
    'CODEX_HOME=' + credential,
    ...mount(config.checkout, checkout, config.documentationOnly),
    ...mount(config.storage, storage),
    ...mount(config.credentials, credential),
    ...mount(config.database, database, true),
    ...mount(file, assignment, true),
    ...(config.github ? mount(config.github.privateKeyFile, githubKey, true) : []),
  ];
}

async function existingHost(name: string) {
  const running = await docker(
    'container',
    'ls',
    '-a',
    '--filter',
    'name=^/' + name + '$',
    '--format',
    '{{.ID}}',
  );
  if (!running.trim()) return undefined;
  const rows = JSON.parse(await docker('container', 'inspect', name)) as Array<
    {
      Id: string;
      Image: string;
      Config: { Labels: Record<string, string> };
      State: { Running: boolean; StartedAt: string };
    } & Parameters<typeof matchesHostPolicy>[0]
  >;
  return rows[0];
}

/** Start or reconcile only the locally approved private Host for this captured assignment. */
export async function startHost(input: unknown) {
  const config = hostAssignmentSchema.parse(input);
  const network = JSON.parse(await docker('network', 'inspect', config.network)) as Array<{
    Internal: boolean;
  }>;
  if (!network[0]?.Internal) throw new Error('Host requires the private platform data network');
  if (config.egress) await verifyEgress(config.egress);
  const image = await verifyHostImage(config.image);
  const file = prepare(config);
  const name = 'arcnexus-host-' + textDigest(config.credentials);
  const binding = textDigest(JSON.stringify([config, hostPolicyIdentity]));
  const existing = await existingHost(name);
  if (existing) {
    if (
      existing.Image !== image ||
      existing.Config.Labels['io.arcnexus.assignment'] !== binding ||
      !matchesHostPolicy(existing)
    )
      throw new Error('Existing Host belongs to a different approved assignment');
    if (!existing.State.Running) await docker('start', name);
    await waitForHost(existing.Id);
    return { id: existing.Id, name };
  }
  const args = containerArguments(config, file, name, binding);
  const id = await withHostPolicy(async (policy) =>
    (await docker('run', '-d', ...policy, ...args, image)).trim(),
  );
  await waitForHost(id);
  return { id, name };
}

async function verifyEgress(network: string) {
  const [bridge] = JSON.parse(await docker('network', 'inspect', network)) as Array<{
    Internal: boolean;
    Driver: string;
  }>;
  if (!bridge || bridge.Internal || bridge.Driver !== 'bridge')
    throw new Error('Host outbound access requires a dedicated Docker bridge');
}
