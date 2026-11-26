import { execFile, execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import type { HostAssignment } from './host-assignment.js';

const run = promisify(execFile);
const executable = '/usr/bin/docker';

/** Invoke the trusted local engine with explicit arguments and keep complete diagnostics. */
export async function docker(...args: string[]) {
  return (await run(executable, args, { encoding: 'utf8', maxBuffer: Infinity })).stdout;
}

interface Image {
  Id: string;
  RootFS: { Layers: string[] };
  Config: { Entrypoint: string[]; Labels: Record<string, string> };
}
type Definition = HostAssignment['image'];

async function inspect(ref: string) {
  const rows = JSON.parse(await docker('image', 'inspect', ref)) as Image[];
  if (!rows[0]) throw new Error('Assigned image is unavailable');
  return rows[0];
}

/** Resolve an immutable image and prove it inherits the approved Host image. */
export async function verifyHostImage(definition: Definition) {
  const base = await inspect(definition.base);
  const image = definition.source === 'base' ? base : await assignedImage(definition);
  if (image.Id !== definition.approvedImage || base.Config.Labels['io.arcnexus.worker'] !== 'host')
    throw new Error('The Host image differs from the approved artifact');
  if (
    JSON.stringify(image.Config.Entrypoint) !== JSON.stringify(base.Config.Entrypoint) ||
    !base.RootFS.Layers.every((layer, index) => image.RootFS.Layers[index] === layer)
  )
    throw new Error('The project image does not inherit the approved Host');
  return image.Id;
}

async function assignedImage(definition: Exclude<Definition, { source: 'base' }>) {
  if (definition.source === 'registry') {
    try {
      return await inspect(definition.ref);
    } catch {
      await docker('pull', definition.ref);
      return inspect(definition.ref);
    }
  }
  await verifyDockerfile(definition);
  try {
    return await inspect(definition.approvedImage);
  } catch {
    const id = await buildCapturedImage(definition);
    return inspect(id);
  }
}

async function verifyDockerfile(definition: Extract<Definition, { source: 'dockerfile' }>) {
  const { checkout, revision, dockerfile } = definition;
  if ((await inspect(definition.baseRef)).Id !== definition.base)
    throw new Error('The local Dockerfile base does not resolve to the approved Host image');
  const file = execFileSync('/usr/bin/git', ['show', revision + ':' + dockerfile], {
    cwd: checkout,
    encoding: 'utf8',
    maxBuffer: Infinity,
  });
  if (
    file
      .split(/\r?\n/)
      .find((line) => /^\s*FROM\s/i.test(line))
      ?.trim() !==
    'FROM ' + definition.baseRef
  )
    throw new Error('The approved Dockerfile must start from its approved Host base reference');
}

async function buildCapturedImage(definition: Extract<Definition, { source: 'dockerfile' }>) {
  const { checkout, revision, dockerfile } = definition;
  const temporary = mkdtempSync(join(tmpdir(), 'arc-host-image-'));
  try {
    const receipt = join(temporary, 'iid');
    await archiveBuild(checkout, revision, dockerfile, receipt);
    return readFileSync(receipt, 'utf8').trim();
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

async function archiveBuild(
  checkout: string,
  revision: string,
  dockerfile: string,
  receipt: string,
) {
  const source = spawn('/usr/bin/git', ['archive', revision], {
    cwd: checkout,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const build = spawn(executable, ['build', '--iidfile', receipt, '-f', dockerfile, '-'], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const [_, [sourceStatus], [buildStatus]] = await Promise.all([
    pipeline(source.stdout, build.stdin),
    once(source, 'exit'),
    once(build, 'exit'),
  ]);
  if (sourceStatus !== 0 || buildStatus !== 0)
    throw new Error('The pinned Host image build failed');
}
