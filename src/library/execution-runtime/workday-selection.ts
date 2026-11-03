import { realpathSync } from 'node:fs';
import { InputError } from '../architecture/config.js';
import { digest } from '../architecture/assignment.js';
import { Portfolio } from '../portfolio/portfolio.js';
import { git } from '../operations/process.js';

interface WorkdayIdentity {
  id: string;
  mode: string;
  status: string;
  project: string;
  packageId: unknown;
}

/** Resolves optional workday identities without global selection state or starting an execution host. */
export class WorkdaySelection {
  /** Selects explicit identity, local package history, or a single applicable retained workday. */
  select(entries: WorkdayIdentity[], id?: string, cwd = process.cwd()): WorkdayIdentity {
    const workdays = entries.filter((entry) => entry.mode === 'workday');
    if (id !== undefined) return this.unique(workdays.filter((entry) => entry.id === id));
    const local = this.context(cwd);
    if (local) {
      const latest = workdays
        .filter((entry) => entry.project === local.key && entry.packageId === local.packageId)
        .at(-1);
      return this.unique(latest ? [latest] : []);
    }
    const active = workdays.filter(
      (entry) => !['stopped', 'completed', 'cancelled', 'failed'].includes(entry.status),
    );
    return this.unique(active.length ? active : workdays);
  }

  /** Rejects absence and ambiguity rather than silently selecting another package. */
  private unique(entries: WorkdayIdentity[]): WorkdayIdentity {
    if (entries.length !== 1)
      throw new InputError('Unknown or ambiguous workday; specify its identity');
    return entries[0]!;
  }

  /** Uses current declarations only for local targeting; retained execution authority remains unchanged. */
  private context(cwd: string) {
    let common: string;
    try {
      common = realpathSync(
        git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim(),
      );
    } catch (error) {
      if (String(error).includes('not a git repository')) return undefined;
      throw error;
    }
    const portfolio = new Portfolio();
    try {
      return {
        key: digest(common).slice(0, 24),
        packageId: portfolio.packageTarget(undefined, cwd).packageId,
      };
    } finally {
      portfolio.close();
    }
  }
}
