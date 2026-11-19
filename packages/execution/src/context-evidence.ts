import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { HostTask } from './index.js';

/** Reference complete immutable task history without replaying every artifact path into the prompt. */
export function retainedEvidence(
  task: Pick<HostTask, 'evidence' | 'store'>,
  current: readonly (string | undefined)[] = [],
): string[] {
  const references = [
    ...new Set(
      task.evidence.filter((path) => !/-retained-evidence-[a-f0-9]{64}\.json$/.test(path)),
    ),
  ];
  const direct = current.filter((path) => path !== undefined);
  if (!references.length) return direct;
  const identity = createHash('sha256').update(JSON.stringify(references)).digest('hex');
  const name = `retained-evidence-${identity}.json`;
  const prior = task.evidence.findLast((path) => path.endsWith(`-${name}`) && existsSync(path));
  const index = {
    kind: 'retained-task-evidence',
    instructions:
      'Complete historical artifact references. Read relevant observations through mapped read-file, paging with nextOffset when needed. Current assignment diagnostics and accepted criteria remain authoritative; historical failures may already be resolved.',
    references,
  };
  const path = prior ?? task.store(name, JSON.stringify(index, null, 2));
  return [...new Set([path, ...direct])];
}
