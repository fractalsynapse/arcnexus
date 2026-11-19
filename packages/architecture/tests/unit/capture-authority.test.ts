import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Architecture } from '../../src/index.js';

/** Create a committed project without touching maintained authority files. */
function project() {
  const root = mkdtempSync(join(tmpdir(), 'architecture-capture-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  const write = (path: string, content: string) => {
    const file = join(root, path);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, content);
  };
  git('init');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  git('remote', 'add', 'origin', 'https://example.test/project.git');
  write('.arc/architecture/project.yaml', [
    'id: fixture',
    'remote: https://example.test/project.git',
    'contractRegistry: registry.yaml',
    'director: { component: director, activity: planning }',
    'verifier: { component: reviewer, activity: assessment }',
    '',
  ].join('\n'));
  write('registry.yaml', 'contracts: []\n');
  write('.arc/architecture/components/architecture.yaml',
    'id: architecture\npurpose: Original authority\nowns: [original]\nactivities: {}\n');
  git('add', '.');
  git('commit', '-m', 'initial');
  return { root, git, write };
}

test('active capture stays immutable when a later accepted revision changes authority', () => {
  const f = project();
  try {
    const architecture = new Architecture();
    const active = architecture.capture(f.root);
    f.write('.arc/architecture/components/architecture.yaml',
      'id: architecture\npurpose: Revised authority\nowns: [revised]\nactivities: {}\n');
    f.git('add', '.');
    f.git('commit', '-m', 'accepted change');
    const fresh = architecture.capture(f.root);
    assert.equal(active.components.architecture?.purpose, 'Original authority');
    assert.deepEqual(active.components.architecture?.owns, ['original']);
    assert.equal(fresh.components.architecture?.purpose, 'Revised authority');
    assert.deepEqual(fresh.components.architecture?.owns, ['revised']);
    assert.notEqual(active.source.revision, fresh.source.revision);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
