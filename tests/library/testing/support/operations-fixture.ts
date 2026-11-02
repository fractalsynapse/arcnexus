import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { minimalWorkflowFixture } from './workflow-fixture.js';

/** Reuses the single shared verification definition for native agent-operation acceptance. */
export function minimalOperationFixture(t: any, mode = 'success'): any {
  const fixture = minimalWorkflowFixture(t, mode);
  fixture.configure({ operations: join(fixture.root, 'operations.jsonl'), operationId: 'verify' });
  return fixture;
}

/** Declares a distinct agent recipe while retaining the original mandatory verification operation. */
export function configureAgentOperation(f: any, args: string[]): void {
  const path = join(f.repo, 'architecture/components/platform.json');
  const platform = JSON.parse(readFileSync(path, 'utf8'));
  platform.operations.verify = ['verify'];
  platform.operations['agent-probe'] = ['agent'];
  writeFileSync(path, JSON.stringify(platform));
  const operation = JSON.parse(
    readFileSync(join(f.repo, 'architecture/operations/verify.yaml'), 'utf8'),
  );
  writeFileSync(
    join(f.repo, 'architecture/operations/agent-probe.yaml'),
    JSON.stringify({ ...operation, id: 'agent-probe', args }),
  );
  f.configure({ operationId: 'agent-probe' });
}
