import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { test, type TestContext } from 'node:test';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Qualifies actual subprocess filesystem enforcement through the assembled adapter. */
class ConfinementScenarios {
  /** Prepared dependencies stay readable but cannot be modified by shell descendants or broad output grants. */
  async preparedDependencies(t: TestContext): Promise<void> {
    const root = this.fixture(t);
    const { SourceConfinement } = await import(resolve('dist/library/operations/confinement.js'));
    mkdirSync(join(root, 'node_modules'));
    writeFileSync(join(root, 'node_modules/dependency'), 'original');
    const adapter = new SourceConfinement({
      workspace: root,
      reads: ['.'],
      outputs: ['node_modules', 'generated'],
      readOnlyOutputs: ['node_modules'],
      temporaryRoot: root + '-private',
      executable: process.env.ARCNEXUS_TEST_CODEX!,
      toolDirectories: [dirname(process.execPath), dirname(process.env.ARCNEXUS_TEST_CODEX!)],
    });
    const script =
      "const f=require('fs');if(f.readFileSync('node_modules/dependency','utf8')!=='original')process.exit(6);f.writeFileSync('generated/result','ok');try{f.writeFileSync('node_modules/dependency','bad');process.exit(7)}catch(e){if(!['EROFS','EPERM','EACCES'].includes(e.code))throw e;}";
    const command = adapter.command({ command: process.execPath, args: ['-e', script] });
    const result = spawnSync(command.command, command.args, {
      cwd: root,
      env: adapter.environment(),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(root, 'node_modules/dependency'), 'utf8'), 'original');
    assert.equal(readFileSync(join(root, 'generated/result'), 'utf8'), 'ok');
  }

  /** Named programs retain an absolute executable identity under the installed sandbox, including containers. */
  async executableIdentity(t: TestContext): Promise<void> {
    const root = this.fixture(t);
    const module = await import(resolve('dist/library/operations/confinement.js'));
    const adapter = new module.SourceConfinement({
      workspace: root,
      reads: ['.'],
      outputs: [],
      temporaryRoot: root + '-private',
      executable: process.env.ARCNEXUS_TEST_CODEX!,
      toolDirectories: [dirname(process.execPath)],
    });
    const command = adapter.command(
      { command: 'node', args: ['-p', 'JSON.stringify({executable:process.execPath})'] },
      root,
      dirname(process.execPath),
    );
    const result = spawnSync(command.command, command.args, {
      cwd: root,
      env: adapter.environment(),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(isAbsolute(JSON.parse(result.stdout).executable), true);
    assert.equal(readFileSync(join(root, 'source.txt'), 'utf8'), 'original');
  }

  /** Makes the actual resolver readable without giving a network-enabled command a writable handle. */
  async resolver(t: TestContext): Promise<void> {
    const root = this.fixture(t);
    const module = await import(resolve('dist/library/operations/confinement.js'));
    const adapter = new module.SourceConfinement({
      workspace: root,
      reads: ['.'],
      outputs: [],
      temporaryRoot: root + '-private',
      executable: process.env.ARCNEXUS_TEST_CODEX!,
      network: true,
    });
    const script =
      "const f=require('fs');f.readFileSync('/etc/resolv.conf');try{f.closeSync(f.openSync('/etc/resolv.conf','r+'));process.exit(8)}catch(e){if(!['EROFS','EPERM','EACCES'].includes(e.code))throw e;}";
    const command = adapter.command({ command: process.execPath, args: ['-e', script] });
    const result = spawnSync(command.command, command.args, {
      cwd: root,
      env: adapter.environment(),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(root, 'source.txt'), 'utf8'), 'original');
  }

  /** Allows installer cleanup inside generated output while keeping maintained source immutable. */
  async cleansGenerated(t: TestContext): Promise<void> {
    const root = this.fixture(t);
    const module = await import(resolve('dist/library/operations/confinement.js'));
    const authority = {
      workspace: root,
      reads: ['.'],
      outputs: ['generated'],
      temporaryRoot: root + '-private',
      executable: process.env.ARCNEXUS_TEST_CODEX!,
    };
    const adapter = new module.SourceConfinement(authority);
    const script =
      "const f=require('fs');for(const n of ['.agents','.codex','.aws','.git']){f.mkdirSync('generated/'+n,{recursive:true});f.rmSync('generated/'+n,{recursive:true});}try{f.writeFileSync('source.txt','bad');process.exit(8)}catch(e){if(!['EROFS','EPERM','EACCES'].includes(e.code))throw e;}";
    const command = adapter.command({ command: process.execPath, args: ['-e', script] });
    const result = spawnSync(command.command, command.args, {
      cwd: root,
      env: adapter.environment(),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(root, 'source.txt'), 'utf8'), 'original');
    symlinkSync(join(root, '.git'), join(root, 'generated/.agents'));
    assert.throws(() => new module.SourceConfinement(authority), /Unsafe symlink/);
  }

  /** Pins diagnostic support outside replaceable target output and rejects changed private snapshots. */
  async capturesSupport(t: TestContext): Promise<void> {
    const root = this.fixture(t);
    const module = await import(resolve('dist/library/operations/confinement.js'));
    const authority = {
      workspace: root,
      reads: ['.'],
      outputs: ['generated'],
      temporaryRoot: root + '-private',
      executable: 'codex',
    };
    const adapter = new module.SourceConfinement(authority);
    const support = join(root + '-private-configuration', 'node-stdio.mjs');
    assert.equal(adapter.environment().NODE_OPTIONS, '--require ' + JSON.stringify(support));
    assert.equal(
      readFileSync(support, 'utf8'),
      readFileSync(resolve('dist/library/operations/node-stdio.js'), 'utf8'),
    );
    assert.equal(adapter.filesystem[resolve('dist/library/operations/node-stdio.js')], undefined);
    new module.SourceConfinement(authority);
    chmodSync(support, 0o600);
    writeFileSync(support, 'changed');
    assert.throws(() => new module.SourceConfinement(authority), /Runtime support.*changed/);
  }

  /** Loads the installed adapter without turning absent support into a skipped success. */
  async prevents(t: TestContext): Promise<void> {
    const root = this.fixture(t);
    const module = await import(resolve('dist/library/operations/confinement.js'));
    const adapter = new module.SourceConfinement({
      workspace: root,
      reads: ['.'],
      outputs: ['generated'],
      temporaryRoot: join(root, '..', `${root.split('/').at(-1)}-private`),
      executable: process.env.ARCNEXUS_TEST_CODEX!,
    });
    const script =
      "const f=require('fs');console.log('stdout-proof');console.error('stderr-proof');f.writeFileSync('generated/result','ok');for(const path of ['source.txt',process.env.CODEX_HOME+'/config.toml']){try{f.writeFileSync(path,'bad');process.exit(7)}catch(e){if(!['EROFS','EACCES','EPERM'].includes(e.code))throw e;}}";
    const command = adapter.command({ command: process.execPath, args: ['-e', script] });
    const result = spawnSync(command.command, command.args, {
      cwd: root,
      env: adapter.environment(),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /stdout-proof/);
    assert.match(result.stderr, /stderr-proof/);
    assert.equal(readFileSync(join(root, 'source.txt'), 'utf8'), 'original');
    assert.equal(readFileSync(join(root, 'generated/result'), 'utf8'), 'ok');
  }

  /** Creates a tracked source baseline with explicitly disposable untracked output. */
  private fixture(t: TestContext): string {
    const root = mkdtempSync(join(tmpdir(), 'arcnexus-confinement-'));
    t.after(() => {
      rmSync(root, { recursive: true, force: true });
      rmSync(root + '-private', { recursive: true, force: true });
      rmSync(root + '-private-configuration', { recursive: true, force: true });
    });
    writeFileSync(join(root, 'source.txt'), 'original');
    mkdirSync(join(root, 'generated'));
    for (const args of [
      ['init', '-q'],
      ['add', 'source.txt'],
    ])
      assert.equal(spawnSync('git', ['-C', root, ...args]).status, 0);
    return root;
  }
}

const scenarios = new ConfinementScenarios();

test(
  'named confined programs retain absolute executable identity',
  {
    skip: !process.env.ARCNEXUS_TEST_CODEX && 'Requires installed native confinement',
  },
  (t) => scenarios.executableIdentity(t),
);

test(
  'network-enabled confinement reads the canonical resolver but denies write handles',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Live qualification requires ARCNEXUS_TEST_CODEX' },
  (t) => scenarios.resolver(t),
);

test(
  'installed confinement permits disposable output cleanup but rejects source aliases',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Live qualification requires ARCNEXUS_TEST_CODEX' },
  (t) => scenarios.cleansGenerated(t),
);

test('confinement captures immutable runtime support outside generated target output', (t) =>
  scenarios.capturesSupport(t));

test(
  'installed confinement allows generated output and prevents source mutation',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Live qualification requires ARCNEXUS_TEST_CODEX' },
  (t) => scenarios.prevents(t),
);

test(
  'installed confinement keeps prepared dependencies read-only despite broad generated outputs',
  { skip: !process.env.ARCNEXUS_TEST_CODEX && 'Live qualification requires ARCNEXUS_TEST_CODEX' },
  (t) => scenarios.preparedDependencies(t),
);

registerSuite({
  component: 'operations',
  level: 'acceptance',
  tags: ['deterministic', 'native-host'],
});
