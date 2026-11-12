import { PlatformExecution } from './platform-execution.js';
import { realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { digest, resolveAssignment, resolveBase, type Assignment } from './assignment.js';
import { loadProjectBindings, type Bindings } from './bindings.js';
import {
  ancestry,
  loadCatalog,
  type Catalog,
  type Component,
  type ExecutionProfile,
} from './components.js';
import { InputError } from './config.js';
import { git } from '../operations/process.js';

export interface ProjectExecution {
  source: string;
  base: string;
  checkoutAtCapture?: string;
  observedStaging?: { repository: string; branch: string };
  commonDir: string;
  key: string;
  packageId: string;
  owners: string[];
  catalog: Catalog;
  bindings: Bindings;
  directorProfile: string;
  directorComponent?: string;
  reviewerProfile: string;
  executable: string;
  verificationInputs: string[];
}

/** Identifies captured source/package authority and machine bindings across host restarts. */
export function executionIdentity(context: ProjectExecution): string {
  return digest(JSON.stringify([context.base, context.packageId, context.bindings]));
}

/** Resolves package context and frozen execution defaults from the current directory. */
export class ExecutionContext {
  /** Requires every profile a component or platform routes work to actually exist. */
  private validateConfiguredProfiles(
    catalog: import('./components.js').Catalog,
    owners: string[],
    config: { directorProfile?: string; reviewerProfile?: string },
  ): void {
    this.validateProfiles(
      catalog,
      [
        ...owners.flatMap((id) => [
          catalog.components[id]!.executionProfile,
          ...Object.values(catalog.components[id]!.activities ?? {}).flatMap((a) =>
            a.profile ? [a.profile] : [],
          ),
        ]),
        config.directorProfile,
        config.reviewerProfile,
      ].filter((id): id is string => id !== undefined),
    );
  }

  /** Discovers repository, committed authority and machine bindings; ambiguous packages fail. */
  resolve(cwd: string, packageId?: string, revision = 'HEAD'): ProjectExecution {
    const { source, base, commonDir, bindings } = this.discovery(cwd, revision);
    const checkout = revision === 'HEAD' ? base : git(source, 'rev-parse', 'HEAD').trim();
    const catalog = loadCatalog(source, base, bindings);
    const config = this.defaults(source, base, catalog);
    const selected = this.selected(catalog, cwd, source, packageId, config.defaultPackage);
    const owners = this.owners(catalog, selected.id);
    this.validateConfiguredProfiles(catalog, owners, config);
    return {
      source,
      base,
      ...(checkout !== base ? { checkoutAtCapture: checkout } : {}),
      commonDir,
      key: digest(commonDir).slice(0, 24),
      packageId: selected.id,
      owners,
      catalog,
      bindings,
      ...config,
      executable: bindings.tools.codex ?? 'codex',
    };
  }

  /** Restricts explicit package selection to locally declared executable authority. */
  private selected(
    catalog: Catalog,
    cwd: string,
    source: string,
    packageId?: string,
    defaultPackage?: string,
  ) {
    const selected = packageId
      ? catalog.components[packageId]
      : this.selectPackage(catalog, relative(source, resolve(cwd)), defaultPackage);
    if (
      !selected ||
      selected.type !== 'package' ||
      selected.repository !== catalog.primaryRepository
    )
      throw new InputError('Selected package is outside the primary repository');
    return selected;
  }

  /** Resolves canonical repository identity and machine bindings without reading mutable authority. */
  private discovery(cwd: string, revision: string) {
    const { source, base } = resolveBase(cwd, revision);
    const commonDir = realpathSync(
      git(source, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim(),
    );
    const bindings = loadProjectBindings(source);
    return { source, base, commonDir, bindings };
  }

  /** Selects executable descendants while containers contribute inherited context only. */
  private owners(catalog: Catalog, packageId: string): string[] {
    const owners = Object.values(catalog.components)
      .filter(
        (c) =>
          !['package', 'platform'].includes(c.type) &&
          c.verification.length &&
          ancestry(catalog, c.id).some((parent) => parent.id === packageId),
      )
      .map((c) => c.id);
    return owners;
  }

  /** Resolves an assignment solely against the source authority captured for the run. */
  assignment(context: ProjectExecution, owner: string, value: Assignment, profile?: string) {
    const director =
      owner === context.directorComponent &&
      value.kind === 'research' &&
      profile === context.directorProfile;
    if (!context.owners.includes(owner) && !director)
      throw new InputError('Owner is outside captured package');
    return resolveAssignment(context.source, context.base, owner, {
      value,
      capturedCatalog: context.catalog,
      eligibleOwners: context.owners,
      additionalVerification: this.containerChecks(context, owner),
      bindings: context.bindings,
      executionProfile: profile,
    });
  }

  /** Adds declared containing-package checks while retaining owner indices and avoiding duplicate commands. */
  private containerChecks(context: ProjectExecution, owner: string) {
    const lineage = ancestry(context.catalog, owner);
    const seen = new Set(lineage.at(-1)!.verification.map((command) => JSON.stringify(command)));
    return lineage
      .slice(0, -1)
      .flatMap((component) => component.verification)
      .filter((command) => {
        const key = JSON.stringify(command);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  /** Reads declarative director/reviewer profiles without selecting models in scheduling code. */
  private defaults(source: string, base: string, catalog: Catalog) {
    return new PlatformExecution(catalog).defaults(source, base);
  }

  /** Selects the deepest containing package; equal candidates require an explicit default. */
  selectPackage(catalog: Catalog, path: string, defaultId?: string): Component {
    const packages = Object.values(catalog.components).filter(
      (c) =>
        c.type === 'package' &&
        (c.path === '.' || path === c.path || path.startsWith(c.path + '/')),
    );
    const depth = (c: Component) => (c.path === '.' ? 0 : c.path.split('/').length);
    const maximum = Math.max(...packages.map(depth));
    const selected = packages.filter((c) => depth(c) === maximum);
    if (selected.length === 1) return selected[0]!;
    const fallback = selected.find((c) => c.id === defaultId);
    if (fallback) return fallback;
    throw new InputError('Ambiguous or missing package; declare defaultPackage on the platform');
  }

  /** Validates every selected profile through the same executable-policy boundary. */
  validateProfiles(catalog: Catalog, ids: string[]): void {
    for (const id of ids) {
      const profile = catalog.profiles[id];
      if (!profile) throw new InputError('Unknown execution profile: ' + id);
      this.validateProfile(profile);
    }
  }

  /** Rejects obsolete work budgets before any library or project host starts managed execution. */
  validateProfile(profile: ExecutionProfile): void {
    if (profile.schemaVersion < 2)
      throw new InputError(
        `Migrate profile ${profile.id} to a planned execution schema (version 2 or 3)`,
      );
    for (const key of [
      'timeoutSeconds',
      'commandTimeoutSeconds',
      'maxOperationCalls',
      'maxTurns',
      'maxCorrectiveTurns',
      'maxChecklistCalls',
      'maxAttempts',
    ])
      if (Object.hasOwn(profile, key))
        throw new InputError(`Remove obsolete work budget ${key} from profile ${profile.id}`);
  }
}
