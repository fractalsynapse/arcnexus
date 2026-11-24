import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const remote = 'https://example.com/arc-gateway-fixture.git';

export function createProject(root: string, repository = remote) {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git('init', '-q');
  git('remote', 'add', 'origin', repository);
  mkdirSync(join(root, '.arc/architecture'), { recursive: true });
  mkdirSync(join(root, '.arc/goals'), { recursive: true });
  writeFileSync(
    join(root, '.arc/architecture/project.yaml'),
    'id: fixture\nremote: ' + repository + '\ncontractRegistry: registry.yaml\n',
  );
  writeFileSync(join(root, 'registry.yaml'), 'contracts: []\n');
  writeFileSync(join(root, '.arc/goals/first.md'), '---\npriority: 1\n---\n# First goal\n');
  git('add', '.');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.com',
    'commit',
    '-qm',
    'Fixture',
  );
}
