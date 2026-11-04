import assert from 'node:assert/strict';
import { minimalWorkflowFixture } from '../../testing/support/workflow-fixture.js';
import { WorkspaceCliFixture } from '../../testing/support/workspace-cli-fixture.js';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const cli = resolve('dist/cli.js');

export function cleanupIntent(record: any) {
  const stat = lstatSync(record.workspace);
  return {
    schemaVersion: 1,
    id: record.id,
    source: record.source,
    commonDir: record.commonDir,
    base: record.base,
    branch: record.branch,
    workspace: record.workspace,
    device: stat.dev,
    inode: stat.ino,
    members: record.members,
    status: 'removing',
  };
}

/** Reuses minimal architectural authority and supplies shared setup operations for workspace cases. */
export function fixture(t: any, setup: any = []): any {
  const f = minimalWorkflowFixture(t);
  writeFileSync(join(f.repo, 'source.txt'), 'original\n');
  writeFileSync(join(f.repo, '.gitignore'), 'generated/\n.env\n');
  writeEnvironment(f.repo, setup);
  f.commit();
  const bindings = join(f.root, 'minimal-bindings.json');
  const workspace = new WorkspaceCliFixture(f, bindings);
  return {
    ...f,
    bindings,
    env: workspace.env,
    prepareArgs: workspace.prepareArgs,
    run: (...args: string[]) => workspace.command(...args),
    prepare: (...args: string[]) => workspace.prepare(...args),
    cleanup: (id: string) => workspace.cleanup(id),
  };
}

/** Captures each explicit test recipe as an operation without inferring command equivalence. */
export function writeEnvironment(repo: string, setup: any[]): void {
  const path = join(repo, 'architecture/components/platform.json');
  const platform = JSON.parse(readFileSync(path, 'utf8'));
  const template = JSON.parse(
    readFileSync(join(repo, 'architecture/operations/verify.yaml'), 'utf8'),
  );
  for (const [index, command] of setup.entries()) {
    const id = `setup-${index}`;
    writeFileSync(
      join(repo, `architecture/operations/${id}.yaml`),
      JSON.stringify({ ...template, ...command, id }),
    );
    platform.operations[id] = ['setup'];
  }
  writeFileSync(path, JSON.stringify(platform));
}

export function evidence(f: any, record: any): any {
  const dir = join(f.state, 'runs', record.id);
  const reports = ['report.json', 'report.md'].map((name: any) => readFileSync(join(dir, name)));
  return {
    dir,
    /** Requires cleanup to preserve the original JSON and Markdown report bytes. */
    assertReports() {
      for (const [i, name] of ['report.json', 'report.md'].entries()) {
        assert.deepEqual(readFileSync(join(dir, name)), reports[i], `${name} changed`);
      }
    },
  };
}

/** Finds only a descendant launcher of the test's known host, using host rather than sandbox PIDs. */
export function managedScope(pid: number): string | undefined {
  try {
    const args = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
    const launcher = args.findIndex((arg) => arg.endsWith('/scope-launcher.js'));
    if (launcher >= 0) return args[launcher + 1];
    const children = readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim();
    for (const child of children.split(/\s+/).filter(Boolean)) {
      const scope = managedScope(Number(child));
      if (scope) return scope;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return undefined;
}
