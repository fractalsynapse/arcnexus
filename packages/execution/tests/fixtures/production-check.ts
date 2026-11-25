import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';
import { release } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { parse, stringify } from 'yaml';
import { Coordination } from '../../../coordination/src/index.js';
import { Execution, HostTask } from '../../src/index.js';
import { checkEnvironment, checkMounts } from '../../src/check-sandbox.js';
import { RoundConsumptionFixture } from './round-consumption.js';

const catalog = '.arc/architecture';

/** Isolate native check prerequisites with committed authority and a real admitted SQLite writer. */
export class ProductionCheckFixture extends RoundConsumptionFixture {
  private task?: HostTask;

  /** Commit explicit commands and ownership before the production architecture capture. */
  constructor(t: TestContext) {
    super(t, 'https://github.com/example/production-check.git');
    const path = join(this.root, catalog, 'components/work.yaml');
    const work = parse(readFileSync(path, 'utf8'));
    work.owns = ['baseline', 'nested'];
    work.activities.testing = {
      role: 'assessor',
      profile: 'work',
      operations: ['fixture-check', 'failing-check'],
      standards: [],
      instructions: ['Exercise captured native commands'],
    };
    writeFileSync(path, stringify(work));
    this.commands();
    this.git('add', '.');
    this.git('commit', '-m', 'Declare native check prerequisite fixture');
  }

  /** Install compiler output as a captured command without requiring candidate dependencies. */
  private commands() {
    mkdirSync(join(this.root, 'nested'));
    const command = readFileSync(new URL('./production-check-command.js', import.meta.url), 'utf8');
    writeFileSync(join(this.root, 'nested/command.mjs'), command);
    for (const [id, phase] of [
      ['fixture-check', 'success'],
      ['failing-check', 'failure'],
    ]) {
      const operation = {
        id,
        category: 'check',
        tool: 'check',
        command: '/usr/bin/node',
        args: ['command.mjs', phase],
        cwd: 'nested',
        network: false,
      };
      writeFileSync(join(this.root, catalog, 'operations', id + '.yaml'), stringify(operation));
    }
  }

  /** Admit through Execution and materialize the captured tree before invoking HostTask.check. */
  async open() {
    const execution = new Execution(
      this.architecture,
      new Coordination(this.storage),
      this.storage,
    );
    const signal = new AbortController().signal;
    const task = await execution.admit(
      { directory: this.root, goal: 'Diagnose native checks' },
      signal,
    );
    assert(task instanceof HostTask, JSON.stringify(task));
    this.task = task;
    task.planningWorkspace(signal);
    return task;
  }

  /** Release the worktree and SQLite writer while their repository still exists. */
  protected override cleanup() {
    try {
      this.task?.cleanup();
    } finally {
      this.task?.close();
    }
    super.cleanup();
  }

  /** Retain complete observable runtime policy and namespace probes before the check attempts. */
  diagnose(task: HostTask) {
    const observations = {
      node: process.versions,
      kernel: release(),
      runtime: task.config.runtime ?? 'unavailable',
      capture: task.capture.source.revision,
      tree: this.git('rev-parse', 'HEAD^{tree}'),
      environment: checkEnvironment,
      sandbox: checkMounts(task.worktree!, task.config.common),
      ...runtimePolicy(),
    };
    const path = task.store('namespace-prerequisite.json', JSON.stringify(observations, null, 2));
    console.log(JSON.stringify({ nativeCheckDiagnostic: { path, ...observations } }));
  }
}

const policyPaths = [
  '/proc/self/status',
  '/proc/self/uid_map',
  '/proc/self/gid_map',
  '/proc/self/attr/current',
  '/proc/sys/user/max_user_namespaces',
  '/proc/sys/kernel/unprivileged_userns_clone',
  '/proc/sys/kernel/apparmor_restrict_unprivileged_userns',
];

/** Compare raw user-namespace creation with Bubblewrap before any overlay or command can interfere. */
function runtimePolicy() {
  return {
    files: Object.fromEntries(policyPaths.map((path) => [path, readPolicy(path)])),
    namespaces: Object.fromEntries(
      ['user', 'net', 'mnt'].map((name) => [name, readlinkSync('/proc/self/ns/' + name)]),
    ),
    probes: [
      probe('/usr/bin/bwrap', ['--version']),
      probe('/usr/bin/unshare', ['--version']),
      probe('/usr/bin/unshare', ['--user', '/usr/bin/true']),
      probe('/usr/bin/bwrap', [
        '--unshare-user',
        '--ro-bind',
        '/usr',
        '/usr',
        '--symlink',
        'usr/lib',
        '/lib',
        '--symlink',
        'usr/lib64',
        '/lib64',
        '--',
        '/usr/bin/true',
      ]),
    ],
  };
}

/** Preserve unavailable policy fields explicitly rather than guessing effective host configuration. */
function readPolicy(path: string) {
  try {
    return { text: readFileSync(path, 'utf8') };
  } catch (error) {
    return { unavailable: String(error) };
  }
}

/** Observe a minimal subprocess solely for diagnosis, without substituting its exit for a check. */
function probe(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return {
    command,
    args,
    cwd: process.cwd(),
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message,
  };
}
