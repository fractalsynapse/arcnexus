import type { ProjectExecution } from '../architecture/execution-context.js';

/** Reads repository destination from captured architecture rather than mutable Git remotes. */
export function runDestination(context: ProjectExecution, mode?: 'live' | 'simulation'): string {
  const source = context.catalog.configurationSources.find((entry) =>
    /^architecture\/environment\.(yaml|yml|json)$/.test(entry.path),
  );
  const repository = (source?.value as { workspace?: { primary?: { repository?: string } } })
    ?.workspace?.primary?.repository;
  const match = repository?.match(
    /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/,
  );
  if (match) return match[1]!;
  if (mode === 'simulation') return context.catalog.primaryRepository!;
  throw new Error('Live collaboration requires a captured GitHub repository destination');
}
