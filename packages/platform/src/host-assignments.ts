import type { Context } from 'cordis';
import type { WorkflowRequests } from '../../coordination/src/index.js';

interface Binding {
  operator: string;
  assigned(provider: string): string[];
}

/** Route only a pinned project identity to its designated admitted launcher. */
export function hostAssignments(
  catalog: Context['catalog'],
  requests: WorkflowRequests,
  binding: Binding,
) {
  return async function* (provider: string, signal: AbortSignal) {
    const remotes = new Set(binding.assigned(provider));
    const notices = await requests.watch([...remotes], signal);
    try {
      while (!signal.aborted) {
        for (const { id, remote } of await catalog.list(binding.operator)) {
          if (!remotes.has(remote)) continue;
          const assignment = await requests.loadAssignment(remote);
          if (!signal.aborted && assignment) yield { project: id, ...assignment };
        }
        if ((await notices.next()).done) break;
      }
    } finally {
      await notices.return?.();
    }
  };
}
