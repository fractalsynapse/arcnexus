import { posix } from 'node:path';
import { git } from '../operations/process.js';
import { classifyComponentPath, type Component } from './components.js';
import { ancestry, covered } from './component-paths.js';
import { ConfigurationReader, isConfiguration, type ConfigurationSource } from './configuration.js';
import type { MigrationAuthority } from './migration-authority.js';
import { MigrationComponent } from './migration-component.js';
import { MigrationPolicies } from './migration-policies.js';
import { MigrationRecipes } from './migration-recipes.js';
import { validateSchema } from './schema.js';

type Declaration = Record<string, any>;

type Lifecycle = Record<string, Record<string, string[]>>;

/** Builds a proposed configuration family without executing commands or modifying source. */
export class MigrationDraft {
  private readonly sources: ConfigurationSource[];

  private readonly files = new Map<string, unknown | null>();

  private readonly components: Record<string, Declaration> = {};

  private readonly verification = new Map<string, string[]>();

  private readonly profiles = new Map<string, Declaration>();

  private readonly recipes: MigrationRecipes;

  private readonly environment: Declaration;

  /** Captures every authored recipe and keeps generated operations separate from editable source. */
  constructor(private readonly context: MigrationAuthority) {
    const reader = new ConfigurationReader();
    this.sources = git(
      context.source,
      'ls-tree',
      '-r',
      '--name-only',
      context.base,
      '--',
      'architecture',
    )
      .trim()
      .split('\n')
      .filter(isConfiguration)
      .map((path) => reader.revision(context.source, context.base, path));
    this.environment = structuredClone(
      this.source('architecture/environment').value,
    ) as Declaration;
    this.recipes = new MigrationRecipes([
      ...this.group('operations').map((source) => source.value),
      ...(this.group('components').every((s) => (s.value as Declaration).schemaVersion === 5)
        ? []
        : this.runners()),
    ]);
  }

  /** Resolves references before reducing policy; final catalog validation remains mandatory before applying this draft. */
  create(): Map<string, unknown | null> {
    const declarations = this.group('components');
    if (this.migrated(declarations)) return this.files;
    if (declarations.some((s) => (s.value as Declaration).schemaVersion !== 4))
      throw new Error('Component migration requires one unmixed version-four family');
    this.extractVerification(declarations);
    const lifecycle = this.lifecycle();
    this.testPreparation();
    const operations = this.recipes.convert();
    this.convertComponents(declarations, operations.identities);
    this.attachLifecycle(lifecycle, operations.identities);
    this.writeOperations(operations.definitions);
    this.writeComponents(declarations);
    this.writeProfiles(operations.identities);
    this.files.set(this.source('architecture/environment').path, {
      schemaVersion: 4,
      workspace: this.environment.workspace,
    });
    this.files.set(this.source('architecture/execution').path, null);
    return this.files;
  }

  /** Recognizes a complete new configuration family without silently accepting executable leftovers. */
  private migrated(declarations: ConfigurationSource[]): boolean {
    if (!declarations.every((source) => (source.value as Declaration).schemaVersion === 5))
      return false;
    if (this.environment.schemaVersion !== 4)
      throw new Error('Migrate mixed environment authority explicitly');
    for (const [group, version] of [
      ['operations', 4],
      ['test-profiles', 2],
    ] as const)
      for (const source of this.group(group))
        if ((source.value as Declaration).schemaVersion !== version)
          throw new Error('Migrate mixed ' + group + ' authority explicitly: ' + source.path);
    return true;
  }

  /** Resolves a unique captured definition without relying on filename extensions. */
  private source(stem: string): ConfigurationSource {
    const found = this.sources.filter(
      (source) => source.path.replace(/\.(json|ya?ml)$/, '') === stem,
    );
    if (found.length !== 1) throw new Error('Missing or ambiguous migration definition: ' + stem);
    return found[0]!;
  }

  /** Selects all authored definitions, including unused profiles that would otherwise retain legacy recipes. */
  private group(name: string): ConfigurationSource[] {
    return this.sources.filter((source) => source.path.startsWith('architecture/' + name + '/'));
  }

  /** Preserves legacy host-command working location, output grants and unrestricted network access explicitly. */
  private commandContext(repository = this.context.catalog.primaryRepository!) {
    return {
      repository,
      cwd: '.',
      category: 'cli-check',
      activities: [],
      generatedDirectories: [
        ...(this.repositoryEnvironment(repository).generatedDirectories ?? []),
      ],
      artifacts: [],
      network: true,
    };
  }

  /** Extracts every declared host check before replacing component-level recipes with references. */
  private extractVerification(sources: ConfigurationSource[]): void {
    for (const source of sources) {
      const raw = source.value as Component;
      const owner = this.context.catalog.components[raw.id]!;
      this.verification.set(
        raw.id,
        this.verificationCommands(raw).map((command) =>
          this.recipes.add(
            command,
            this.commandContext(owner.repository || undefined),
            'Verify ' + raw.id,
          ),
        ),
      );
    }
  }

  /** Anchors inherited legacy commands to each executable owner's repository before operation conversion. */
  private verificationCommands(component: Component): Component['verification'] {
    if (['platform', 'package'].includes(component.type)) return [];
    return ancestry(this.context.catalog, component.id).flatMap((owner) => owner.verification);
  }

  /** Resolves recipe outputs in their declaring repository, never from a different member. */
  private repositoryEnvironment(repository: string): Declaration {
    if (repository === this.context.catalog.primaryRepository) return this.environment;
    const member = this.environment.workspace.dependencies.find(
      (item: Declaration) => item.id === repository,
    );
    if (!member) throw new Error('Unknown recipe repository: ' + repository);
    return member;
  }

  /** Converts each repository's finite recipes while requiring existing accountable execution owners. */
  private lifecycle(): Lifecycle {
    if (!this.environment.workspace)
      throw new Error('Declare primary repository identity before migration');
    const primary = this.context.catalog.primaryRepository!;
    const result: Lifecycle = { [primary]: this.lifecycleRecipes(primary, this.environment) };
    for (const dependency of this.environment.workspace.dependencies ?? []) {
      result[dependency.id] = this.lifecycleRecipes(dependency.id, dependency);
      delete dependency.prerequisites;
      delete dependency.setup;
      delete dependency.generatedDirectories;
    }
    return result;
  }

  /** Preserves ordered references and rejects output-only policy that has no operation to carry it. */
  private lifecycleRecipes(repository: string, declaration: Declaration): Record<string, string[]> {
    const recipes = [...(declaration.prerequisites ?? []), ...(declaration.setup ?? [])];
    const owners = Object.values(this.context.catalog.components).filter(
      (owner) => owner.repository === repository && !['platform', 'package'].includes(owner.type),
    );
    if (recipes.length && !owners.length)
      throw new Error(repository + ' lifecycle requires a declared executable owner');
    if (
      !recipes.length &&
      declaration.generatedDirectories?.length &&
      repository !== this.context.catalog.primaryRepository
    )
      throw new Error(repository + ' generated outputs require explicit operation policy');
    return Object.fromEntries(
      ['prerequisites', 'setup'].map((key) => [
        key === 'prerequisites' ? 'preflight' : 'setup',
        (declaration[key] ?? []).map((command: unknown) =>
          this.recipes.add(command, this.commandContext(repository), repository + ' ' + key),
        ),
      ]),
    );
  }

  /** Makes the existing Node adapter's fixed runner explicit using host-validated selected test paths. */
  private runners(): Declaration[] {
    return this.group('test-profiles').map((source) => {
      const profile = structuredClone(source.value) as Declaration;
      validateSchema('test-profile', profile);
      this.profiles.set(profile.id, profile);
      return {
        ...this.commandContext(),
        schemaVersion: 4,
        id: 'migrated-test-' + profile.id,
        purpose: 'Run selected ' + profile.id + ' tests',
        kind: 'command',
        prerequisites: [],
        command: 'node',
        args: ['--test', { context: 'selectedTestFiles' }],
      };
    });
  }

  /** Retains preparation purpose on each reference while sharing identical executable commands. */
  private testPreparation(): void {
    for (const profile of this.profiles.values()) {
      profile.preparation = profile.preparation.map((step: Declaration) => ({
        purpose: step.purpose,
        operation: this.recipes.add(
          { command: step.command, args: step.args },
          this.commandContext(),
          'Prepare tests',
        ),
      }));
      profile.schemaVersion = 2;
      profile.run = 'migrated-test-' + profile.id;
    }
  }

  /** Converts local architectural facts using resolved operation identities and captured execution policy. */
  private convertComponents(
    sources: ConfigurationSource[],
    identities: Record<string, string>,
  ): void {
    for (const source of sources) {
      const raw = source.value as Component;
      const owner = this.context.catalog.components[raw.id]!;
      this.components[raw.id] = new MigrationComponent().convert(
        { ...raw, verification: this.verificationCommands(raw) },
        {
          definitionPath: source.path,
          definitionInOwnerRepository: owner.repository === this.context.catalog.primaryRepository,
          packageRoot: owner.repositoryRoot ?? '.',
          operationIdentities: identities,
          verification: this.verification.get(raw.id)!.map((id) => identities[id]!),
          ...(raw.type === 'platform' ? { execution: this.execution(raw) } : {}),
        },
      );
    }
    this.classification();
  }

  /** Consolidates the declared director and execution defaults without inventing missing role authority. */
  private execution(platform: Component) {
    if (!platform.initialization)
      throw new Error('Declare the director component before migration');
    const defaults = this.source('architecture/execution').value as Declaration;
    return {
      director: {
        component: platform.initialization.componentId,
        profile: this.context.directorProfile,
      },
      reviewerProfile: this.context.reviewerProfile,
      ...(defaults.defaultPackage ? { defaultPackage: defaults.defaultPackage } : {}),
      verificationInputs: this.context.verificationInputs,
    };
  }

  /** Keeps exceptional existing documentation/test classification without authoring ordinary file inventories. */
  private classification(): void {
    for (const owner of Object.values(this.context.catalog.components)) {
      const parent = this.context.catalog.components[owner.parentId ?? ''];
      if (!parent || parent.type !== 'package') continue;
      const rules = (this.components[parent.id]!.classification ??= []);
      for (const kind of ['documentation', 'tests'] as const)
        for (const root of owner.discovery?.[kind] ?? []) {
          const exceptional = owner.inventory?.some(
            (file) =>
              file.kind === kind &&
              covered(file.path, [root]) &&
              classifyComponentPath(owner, file.path) !== kind,
          );
          if (exceptional)
            rules.push({ path: posix.relative(parent.repositoryRoot ?? '.', root) || '.', kind });
        }
      this.components[parent.id]!.classification = [
        ...new Map(rules.map((rule: unknown) => [JSON.stringify(rule), rule])).values(),
      ];
      if (!rules.length) delete this.components[parent.id]!.classification;
    }
  }

  /** Adds required lifecycle operations only to owners in the declaring repository. */
  private attachLifecycle(lifecycle: Lifecycle, identities: Record<string, string>): void {
    for (const owner of Object.values(this.context.catalog.components)) {
      if (['platform', 'package'].includes(owner.type)) continue;
      for (const [usage, ids] of Object.entries(lifecycle[owner.repository!] ?? {}))
        for (const id of ids) this.usage(owner.id, identities[id]!, usage);
    }
  }

  /** Accumulates usages without converting agent availability into an unintended mandatory check. */
  private usage(owner: string, operation: string, usage: string): void {
    const declaration = this.components[owner]!;
    declaration.operations ??= {};
    declaration.operations[operation] = [
      ...new Set([...(declaration.operations[operation] ?? []), usage]),
    ];
  }

  /** Replaces authored operation files and remaps pattern references without retaining duplicate executable recipes. */
  private writeOperations(definitions: Declaration[]): void {
    const sources = this.group('operations');
    for (const source of sources) this.files.set(source.path, null);
    for (const definition of definitions) {
      const source = sources.find((entry) => (entry.value as Declaration).id === definition.id);
      this.files.set(
        source?.path ?? 'architecture/operations/' + definition.id + '.yaml',
        definition,
      );
    }
  }

  /** Hoists only proven equivalent policies after all local execution references have been resolved. */
  private writeComponents(sources: ConfigurationSource[]): void {
    const reduced = new MigrationPolicies(
      this.components as any,
      this.context.catalog.primaryRepository!,
    ).reduce();
    for (const source of sources)
      this.files.set(source.path, reduced[(source.value as Component).id]);
  }

  /** Resolves retained profile references to final deduplicated operation identities. */
  private writeProfiles(identities: Record<string, string>): void {
    for (const source of this.group('test-profiles')) {
      const profile = this.profiles.get((source.value as Declaration).id)!;
      profile.run = identities[profile.run];
      profile.preparation = profile.preparation.map((step: Declaration) => ({
        ...step,
        operation: identities[step.operation],
      }));
      this.files.set(source.path, validateSchema('test-profile-v2', profile));
    }
    for (const source of this.group('patterns')) {
      const pattern = structuredClone(source.value) as Declaration;
      pattern.operationIds = pattern.operationIds.map((id: string) => identities[id] ?? id);
      this.files.set(source.path, pattern);
    }
  }
}
