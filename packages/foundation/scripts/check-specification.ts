import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path/posix';
import { parse } from 'yaml';
import { team } from '../../team/src/index.js';
import { operationID, resolveOperation, type Capture } from '../../architecture/src/index.js';
import { acceptanceScenarios } from '../src/index.js';

const catalogRoot = '.arc/architecture';

type Component = Capture['components'][string];
type Activity = Component['activities'][string];
type Contract = Capture['contracts'][number] & { dependsOn: string[]; scenarios: number };

/** Validate the working copy of the tracked specification for local use and CI. */
class SpecificationCheck {
  private readonly paths: readonly string[];

  /** Supply the Git inventory that determines which paths are subject to checks. */
  constructor(paths: readonly string[]) {
    this.paths = paths;
  }

  /** Fail on the first violation and report applicable executable checks only after validation. */
  run(output: string | undefined): void {
    for (const path of this.paths) {
      if (/\.(?:[cm]?[jt]s|[jt]sx)$/i.test(path)) {
        assert(path.endsWith('.ts'), `Use strict TypeScript (.ts) for tracked code: ${path}`);
      }
    }
    const project = readMapping<Capture['project']>(join(catalogRoot, 'project.yaml'));
    const components = this.catalog<Component>('components');
    this.checkOwnership(components);
    for (const path of this.paths) {
      if (path.endsWith('.md')) this.checkMarkdown(path);
    }
    this.checkActivities(components);
    for (const { component, activity } of [project.director, project.verifier]) {
      assert(
        components.get(component)?.activities[activity],
        `Unknown binding: ${component}/${activity}`,
      );
    }
    this.checkContracts(project.contractRegistry, components);
    this.report(output);
  }

  /** Index definitions and reject repeated IDs or mismatched filenames. */
  private catalog<T extends { id: string }>(kind: string): ReadonlyMap<string, T> {
    const prefix = join(catalogRoot, kind) + '/';
    const index = new Map<string, T>();
    for (const path of this.paths) {
      if (!path.startsWith(prefix) || !path.endsWith('.yaml')) continue;
      const entry = readMapping<T>(path);
      assert(!index.has(entry.id), `Duplicate ${kind} ID`);
      assert.equal(path, `${prefix}${entry.id}.yaml`);
      index.set(entry.id, entry);
    }
    return index;
  }

  /** Refuse all Team coverage findings together, with stable path and conflicting-ID ordering. */
  private checkOwnership(components: ReadonlyMap<string, Component>): void {
    const findings = team.validateCoverage(
      Array.from(components.values()),
      [...this.paths].sort(),
    );
    if (!findings.length) return;

    const diagnostics = findings.map((finding) => {
      const owners =
        finding.kind === 'collision' ? finding.owners.map(({ id }) => id).sort() : [];
      const detail = owners.length ? ` (${owners.join(', ')})` : '';
      return `Specification ownership ${finding.kind}: ${finding.path}${detail}`;
    });
    throw new Error(diagnostics.join('\n'));
  }

  /** Resolve all owners of a tracked path so callers can detect collisions and gaps. */
  private ownersFor(path: string, components: ReadonlyMap<string, Component>): string[] {
    return team.owners(components.values(), path).map(({ id }) => id);
  }

  /** Validate activities against the same tracked catalog used for ownership. */
  private checkActivities(components: ReadonlyMap<string, Component>): void {
    const roles = this.catalog('roles');
    const profiles = this.catalog('execution-profiles');
    const operations = this.catalog<Capture['operations'][string]>('operations');
    const standards = this.catalog('standards');
    const catalog = {
      components: Object.fromEntries(components),
      operations: Object.fromEntries(operations),
    };
    for (const { id, activities } of components.values()) {
      assert(Object.keys(activities).length, `${id} declares no activities`);
      for (const [name, activity] of Object.entries(activities)) {
        const scope = `${id}/${name}`;
        assert(roles.has(activity.role), `${scope}: unknown role ${activity.role}`);
        if (activity.executor === 'host') assert.equal(activity.profile, undefined, scope);
        else
          assert(
            activity.profile && profiles.has(activity.profile),
            `${scope}: unknown profile ${activity.profile}`,
          );
        this.checkActivityReferences(scope, activity, operations, standards);
        this.checkOperationConfiguration(catalog, id, name, activity);
      }
    }
  }

  /** Validate the same resolved parameters and completion bindings used by inspection and execution. */
  private checkOperationConfiguration(
    catalog: Pick<Capture, 'components' | 'operations'>,
    component: string,
    name: string,
    activity: Activity,
  ) {
    const ids = activity.operations.map(operationID);
    for (const id of ids) resolveOperation(catalog, id, component, name);
    assert(
      activity.verification === undefined || Array.isArray(activity.verification),
      `${component}/${name}: verification must be a list`,
    );
    for (const id of activity.verification ?? []) {
      assert(ids.includes(id), `${component}/${name}: unmapped verification ${id}`);
      const operation = resolveOperation(catalog, id, component, name);
      assert(
        operation.command && operation.tool === 'check',
        `${component}/${name}: verification ${id} requires a check command`,
      );
    }
  }

  /** Reject incomplete instructions or references to capabilities absent from the catalog. */
  private checkActivityReferences(
    scope: string,
    activity: Activity,
    operations: ReadonlyMap<string, unknown>,
    standards: ReadonlyMap<string, unknown>,
  ): void {
    assert(activity.instructions?.length, `${scope}: missing instructions`);
    assert(
      Array.isArray(activity.operations) &&
        activity.operations.every((binding) => operations.has(operationID(binding))),
      `${scope}: missing or unknown operations`,
    );
    assert(
      Array.isArray(activity.standards) && activity.standards.every((id) => standards.has(id)),
      `${scope}: missing or unknown standards`,
    );
  }

  /** Verify registered owners, bytes, dependencies and acceptance scenarios. */
  private checkContracts(registry: string, components: ReadonlyMap<string, Component>): void {
    const { contracts } = readMapping<{ contracts: Contract[] }>(registry);
    const ids = new Set(contracts.map(({ id }) => id));
    const scenarios = new Set<string>();
    assert.equal(ids.size, contracts.length, 'Duplicate contract ID');
    for (const item of contracts) {
      const body = readFileSync(item.file);
      assert.deepEqual(
        this.ownersFor(item.file, components),
        [item.owner],
        `Contract owner: ${item.file}`,
      );
      assert.equal(
        createHash('sha256').update(body).digest('hex'),
        item.digest,
        `Contract digest: ${item.file}`,
      );
      assert(
        item.dependsOn.every((id) => ids.has(id)),
        `Unknown dependency: ${item.id}`,
      );
      if (item.stage === 'locked')
        assert(item.acceptedBy && item.acceptedAt, `Missing acceptance: ${item.id}`);
      this.checkScenarios(item, body.toString(), scenarios);
    }
  }

  /** Check the declared count and register scenario IDs across all contracts. */
  private checkScenarios(contract: Contract, body: string, scenarios: Set<string>): void {
    const rows = acceptanceScenarios(body);
    assert.equal(rows.length, contract.scenarios, `Scenario count: ${contract.id}`);
    for (const id of rows) {
      assert(id && !scenarios.has(id), `Duplicate acceptance scenario: ${id}`);
      scenarios.add(id);
    }
  }

  /** Reject missing local links and invalid skill identity or description. */
  private checkMarkdown(path: string): void {
    const contents = readFileSync(path, 'utf8');
    if (path.endsWith('/SKILL.md')) {
      const metadata = parseMapping<{ name?: string; description?: string }>(
        contents.split('---', 3)[1] ?? '',
        path,
      );
      assert.equal(metadata.name, dirname(path).split('/').at(-1), `Skill name: ${path}`);
      assert(metadata.description, `Skill description: ${path}`);
    }
    // Fenced records may preserve verbatim input or excerpts from other directories.
    const prose = contents.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '');
    for (const [, target] of prose.matchAll(/(?<!!)\[[^\]\n]+\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
      if (!target || /^[\w+.-]+:/.test(target)) continue;
      assert(existsSync(join(dirname(path), target)), `Missing link target: ${path} → ${target}`);
    }
  }

  /** Publish the existing CI applicability output and describe the completed checks. */
  private report(output: string | undefined): void {
    const hasExecutableSources = this.paths.some((path) =>
      /^(?:src\/|tests\/|(?:apps|packages)\/[^/]+\/(?:src|tests)\/).+\.ts$/.test(path),
    );
    if (output) appendFileSync(output, `executable=${hasExecutableSources}\n`);
    console.log(
      'Specification checks passed: TypeScript, ownership, activities, contracts, links and skills.',
    );
    if (!hasExecutableSources)
      console.log(
        'Product checks are inapplicable: this revision has no tracked product source or tests.',
      );
  }
}

/** Parse an authored mapping at the YAML boundary before checking its contents. */
function parseMapping<T>(contents: string, path: string): T {
  const value: unknown = parse(contents);
  assert(
    value && typeof value === 'object' && !Array.isArray(value),
    `Expected a mapping: ${path}`,
  );
  return value as T;
}

/** Read a tracked YAML definition for working-copy validation. */
function readMapping<T>(path: string): T {
  return parseMapping(readFileSync(path, 'utf8'), path);
}

const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
new SpecificationCheck(paths).run(process.env.GITHUB_OUTPUT);
