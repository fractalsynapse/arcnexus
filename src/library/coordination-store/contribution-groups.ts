import { dependencySatisfied, type ExecutionAssignment } from './execution-types.js';

/** Derives related unverified engineering work from current dependency edges, without another registry. */
export class ContributionGroups {
  /** Uses the caller's authoritative required assignments in durable insertion order. */
  constructor(private readonly assignments: ExecutionAssignment[]) {}

  /** Identifies engineering contributions without treating research results as unverified source. */
  static engineering(item: ExecutionAssignment): boolean {
    const proposal = item.data.proposal as { kind?: string } | undefined;
    return (proposal?.kind ?? 'change') === 'change';
  }

  /** Prepared dependency source may unblock related engineering, but never satisfies verified delivery. */
  static canEngineer(source: ExecutionAssignment, dependency: ExecutionAssignment): boolean {
    return (
      dependencySatisfied(source, dependency) ||
      (source.runId === dependency.runId &&
        this.engineering(source) &&
        this.engineering(dependency) &&
        dependency.status === 'prepared' &&
        Boolean(dependency.data.contribution))
    );
  }

  /** Returns the connected unfinished contribution set, retaining failed members as honest blockers. */
  group(id: string): ExecutionAssignment[] {
    const selected = new Set([id]);
    const pending = this.assignments.filter(
      (item) =>
        item.status !== 'completed' &&
        !item.data.replacedBy &&
        ContributionGroups.engineering(item),
    );
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of pending) {
        const neighbors = pending.filter(
          (other) => this.connected(item, other) || this.connected(other, item),
        );
        if (!selected.has(item.id) && !neighbors.some((other) => selected.has(other.id))) continue;
        for (const member of [item, ...neighbors]) {
          if (selected.has(member.id)) continue;
          selected.add(member.id);
          changed = true;
        }
      }
    }
    return this.assignments.filter((item) => selected.has(item.id));
  }

  /** Selects fully prepared groups only after every external delivery obligation is satisfied. */
  ready(): ExecutionAssignment[][] {
    const visited = new Set<string>();
    const ready: ExecutionAssignment[][] = [];
    for (const item of this.assignments) {
      if (visited.has(item.id) || item.status !== 'prepared') continue;
      const group = this.group(item.id);
      const ids = new Set(group.map((member) => member.id));
      group.forEach((member) => visited.add(member.id));
      if (
        group.every(
          (member) =>
            member.status === 'prepared' &&
            member.dependencies.every((id) => ids.has(id) || this.delivered(member, id)),
        )
      )
        ready.push(group);
    }
    return ready;
  }

  /** Accepted intent alone does not couple otherwise independent source deliveries. */
  private connected(source: ExecutionAssignment, target: ExecutionAssignment): boolean {
    const milestones = source.data.milestones as Record<string, string> | undefined;
    return source.dependencies.includes(target.id) && milestones?.[target.id] !== 'accepted';
  }

  /** Missing external work remains unsatisfied instead of being inferred from prepared source. */
  private delivered(source: ExecutionAssignment, id: string): boolean {
    const dependency = this.assignments.find((item) => item.id === id);
    return Boolean(dependency && dependencySatisfied(source, dependency));
  }
}
