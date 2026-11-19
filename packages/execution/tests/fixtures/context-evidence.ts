import type { TaskContext } from '../../../architecture/src/index.js';
import type { HostTask } from '../../src/index.js';
import { readToolFile } from '../../src/tool-files.js';

/** Read every immutable index page through the agent's actual mapped reader. */
export function indexReferences(task: HostTask, path: string): string[] {
  let offset: number | null = 0;
  let text = '';
  while (offset !== null) {
    const result = readToolFile(task, path, offset);
    text += result.text;
    offset = result.nextOffset;
  }
  return (JSON.parse(text) as { references: string[] }).references;
}

/** Resolve direct and indexed input references without pretending their layout is prompt authority. */
export function contextEvidence(task: HostTask, input: TaskContext): string[] {
  return (input.evidence ?? []).flatMap((path) => {
    if (typeof path !== 'string') return [];
    return /-retained-evidence-[a-f0-9]{64}\.json$/.test(path)
      ? indexReferences(task, path)
      : [path];
  });
}
