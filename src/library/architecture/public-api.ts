import { DerivedApiCache } from './derived-api-cache.js';
import { assertImportCycles } from './ownership.js';
import { ApiImports } from './api-imports.js';
import ts from 'typescript';
import type { Catalog, Component } from './components.js';
import { covered } from './component-paths.js';
import { CapturedProgram } from './captured-program.js';
import { ApiSchema, type SchemaSurface } from './api-schema.js';
import { RevisionArtifacts } from './revision-artifacts.js';

export interface PublicSurface {
  unresolved: Array<{ path: string; line: number; reason: string }>;
  module?: string;
  sha256?: string;
  exports: Array<{
    name: string;
    signature: string;
    declarations: Array<{ path: string; line: number }>;
  }>;
  schema?: SchemaSurface;
}

/** Derives intentional public symbols and schema associations from immutable source authority. */
export class PublicApiCatalog {
  /** Retains the resolved ownership map; analysis cannot widen an owner's public declarations. */
  constructor(private readonly catalog: Catalog) {}

  /** Shares one compiler program per captured repository and leaves unavailable bindings explicit. */
  resolve(): void {
    for (const [repository, revision] of Object.entries(this.catalog.repositoryRevisions ?? {})) {
      const owners = Object.values(this.catalog.components).filter(
        (c) => c.repository === repository,
      );
      const minimal = owners.filter((c) => c.schemaVersion >= 5);
      if (!minimal.length) continue;
      const cache = new DerivedApiCache(revision, owners);
      if (cache.restore(minimal)) continue;
      this.repository(owners, minimal, new RevisionArtifacts(revision.source, revision.base));
      cache.retain(minimal);
    }
  }

  /** Resolves surfaces before imports so consumers can only rely on validated public symbols. */
  private repository(
    owners: Component[],
    minimal: Component[],
    artifacts: RevisionArtifacts,
  ): void {
    const programs = new Map<string, CapturedProgram>();
    const program = (owner: Component): CapturedProgram => {
      const root = owner.repositoryRoot ?? '.';
      if (!programs.has(root)) programs.set(root, new CapturedProgram(owners, artifacts, root));
      return programs.get(root)!;
    };
    for (const owner of minimal)
      owner.publicApi = (owner.api ?? []).map((entry) =>
        this.entry(owner, entry, program(owner), artifacts),
      );
    for (const owner of minimal)
      owner.observedImports = new ApiImports(owners, program(owner)).inspect(owner);
    this.relationships(minimal);
  }

  /** Projects consumer views and checks the resolved runtime graph, including compiler aliases. */
  private relationships(minimal: Component[]): void {
    const graph = new Map<string, string[]>();
    for (const owner of minimal)
      for (const entry of owner.observedImports ?? [])
        if (entry.target && !entry.typeOnly)
          graph.set(entry.source, [...(graph.get(entry.source) ?? []), entry.target]);
    assertImportCycles(graph);
    for (const owner of minimal)
      owner.observedConsumers = minimal.flatMap((consumer) =>
        (consumer.observedImports ?? [])
          .filter((entry) => entry.owner === owner.id && consumer.id !== owner.id)
          .map((entry) => ({ ...entry, owner: consumer.id })),
      );
  }

  /** Checks owner-local artifacts before exposing their observed module surface or schema identity. */
  private entry(
    owner: Component,
    entry: NonNullable<Component['api']>[number],
    program: CapturedProgram,
    artifacts: RevisionArtifacts,
  ): PublicSurface {
    for (const path of [entry.module, entry.schema].filter((path): path is string => Boolean(path)))
      if (!covered(path, owner.allowedWritePaths))
        throw new Error(`Public API outside ownership: ${path}`);
    const surface: PublicSurface = { exports: [], unresolved: [] };
    if (entry.module) {
      surface.module = entry.module;
      surface.sha256 = artifacts.read(entry.module).sha256;
      surface.exports = this.exports(entry.module, entry.export, program);
      surface.unresolved = program.unresolved(program.source(entry.module));
    }
    if (entry.schema) surface.schema = new ApiSchema(artifacts).inspect(entry.schema);
    return surface;
  }

  /** Resolves explicit names and module re-exports using compiler symbol identity rather than text matching. */
  private exports(
    path: string,
    name: string | undefined,
    program: CapturedProgram,
  ): PublicSurface['exports'] {
    const source = program.source(path);
    const module = program.checker.getSymbolAtLocation(source);
    const exports = module ? program.checker.getExportsOfModule(module) : [];
    if (name && !exports.some((symbol) => symbol.name === name))
      throw new Error(`Missing public export ${name}: ${path}`);
    return exports
      .filter((symbol) => !name || symbol.name === name)
      .map((symbol) => this.symbol(symbol, source, program));
  }

  /** Records re-export targets and source locations without exposing implementation bodies. */
  private symbol(symbol: ts.Symbol, source: ts.SourceFile, program: CapturedProgram) {
    const path = program.path(source);
    const target =
      symbol.flags & ts.SymbolFlags.Alias ? program.checker.getAliasedSymbol(symbol) : symbol;
    const declarations = target.getDeclarations() ?? [];
    if (!declarations.length) throw new Error(`Unresolved public export ${symbol.name}: ${path}`);
    const type =
      target.flags & ts.SymbolFlags.Type
        ? program.checker.getDeclaredTypeOfSymbol(target)
        : program.checker.getTypeOfSymbolAtLocation(target, declarations[0]!);
    return {
      name: symbol.name,
      signature: program.checker.typeToString(type, source, ts.TypeFormatFlags.NoTruncation),
      declarations: declarations.map((declaration) => ({
        path: program.path(declaration.getSourceFile()),
        line:
          declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.getStart()).line +
          1,
      })),
    };
  }
}
