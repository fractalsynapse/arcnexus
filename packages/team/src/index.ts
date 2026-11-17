import type { Context } from 'cordis';

interface ResourceOwner {
  readonly id: string;
  readonly owns: readonly string[];
}

interface Member extends ResourceOwner {
  readonly activities: Readonly<Record<string, { profile?: string; executor?: string }>>;
}

interface TeamQuery {
  readonly component?: string;
  readonly activity?: string;
  readonly priority?: Readonly<Record<string, number>>;
  readonly eligible?: ReadonlySet<string>;
}

/** Resolve roster and ownership from one captured set of component definitions. */
export class Team {
  /** List eligible members in supplied priority order, then by stable component identity. */
  list<T extends Member>(members: Readonly<Record<string, T>>, query: TeamQuery = {}): T[] {
    const { component, activity, priority, eligible } = query;
    return Object.values(members)
      .filter((member) => {
        if (component && member.id !== component) return false;
        if (eligible && !eligible.has(member.id)) return false;
        if (!activity) return true;
        return (
          Object.hasOwn(member.activities, activity) &&
          Boolean(member.activities[activity]?.profile)
        );
      })
      .sort(
        (a, b) => (priority?.[a.id] ?? 0) - (priority?.[b.id] ?? 0) || a.id.localeCompare(b.id),
      );
  }

  /** Return every match, including collisions that a roster filter could otherwise conceal. */
  owners<T extends ResourceOwner>(members: Iterable<T>, path: string): T[] {
    return Array.from(members).filter(({ owns }) =>
      owns.some((root) => path === root || path.startsWith(root + '/')),
    );
  }

  /** Resolve ownership before applying the caller's independent eligibility filter. */
  ownerFor<T extends ResourceOwner>(
    members: Iterable<T>,
    path: string,
    eligible?: ReadonlySet<string>,
  ) {
    const owners = this.owners(members, path);
    const [owner] = owners;
    if (!owner) return { kind: 'unowned' as const, path };
    if (owners.length > 1) return { kind: 'collision' as const, path, owners };
    if (eligible && !eligible.has(owner.id)) return { kind: 'unavailable' as const, path, owner };
    return { kind: 'owned' as const, path, owner };
  }

  /** Identify paths with zero or multiple owners by using the same lookup as checked edits. */
  validateCoverage<T extends ResourceOwner>(members: readonly T[], inventory: readonly string[]) {
    return inventory
      .map((path) => this.ownerFor(members, path))
      .filter(({ kind }) => kind !== 'owned');
  }
}

export const team = new Team();

declare module 'cordis' {
  interface Context {
    team: Team;
  }
}

export const teamPlugin = {
  /** Publish the same stateless roster service used by package consumers. */
  apply(context: Context) {
    context.provide('team', team);
  },
};
