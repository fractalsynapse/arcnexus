import { team } from '../../team/src/index.js';
import type { Component } from './catalog.js';

export type OwnershipFinding =
  | { kind: 'unowned'; path: string }
  | { kind: 'collision'; path: string; owners: string[] };

/** Preserve complete Team decisions in deterministic inventory and component order. */
export function ownershipFindings(
  components: Readonly<Record<string, Component>>,
  paths: readonly string[],
): OwnershipFinding[] {
  const coverage = team.validateCoverage(team.list(components), [...paths].sort());
  return coverage.map((finding) => {
    if (finding.kind === 'collision')
      return {
        kind: finding.kind,
        path: finding.path,
        owners: finding.owners.map(({ id }) => id),
      };
    return { kind: 'unowned', path: finding.path };
  });
}

/** Render the same complete ownership refusal for captured and candidate findings. */
export function ownershipDiagnostic(findings: readonly OwnershipFinding[]): string {
  const messages = findings.map((finding) => {
    const detail = finding.kind === 'collision' ? ` (${finding.owners.join(', ')})` : '';
    return `Architecture ownership ${finding.kind}: ${finding.path}${detail}`;
  });
  return messages.join('\n');
}
