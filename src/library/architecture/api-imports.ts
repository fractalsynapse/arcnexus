import type { Component } from './components.js';
import { covered } from './component-paths.js';
import { CapturedProgram } from './captured-program.js';
import { ImportSymbols, type SourceImport } from './import-symbols.js';

export interface ModuleRelationship {
  source: string;
  module: string;
  target?: string;
  owner?: string;
  symbols: string[];
  typeOnly: boolean;
  unresolved?: string;
}

/** Validates symbol-level public access and derives observed owner relationships from captured source. */
export class ApiImports {
  /** Shares the repository ownership map with a compiler program using the importer's captured configuration. */
  constructor(
    private readonly owners: Component[],
    private readonly program: CapturedProgram,
  ) {}

  /** Derives imports without consulting authored consumers or permitting unknowns to invent dependencies. */
  inspect(owner: Component): ModuleRelationship[] {
    const imports: ModuleRelationship[] = [];
    for (const file of owner.inventory ?? []) {
      if (!/\.[cm]?[jt]sx?$/.test(file.path)) continue;
      const source = this.program.source(file.path);
      for (const reference of new ImportSymbols(this.program).read(source))
        imports.push(this.relationship(owner, file.path, reference));
    }
    return imports;
  }

  /** Resolves the target and validates only cross-owner access against its intentional public entry points. */
  private relationship(
    owner: Component,
    source: string,
    reference: SourceImport,
  ): ModuleRelationship {
    const target = this.program.resolve(this.program.source(source), reference.specifier);
    const relationship: ModuleRelationship = {
      source,
      module: reference.specifier,
      symbols: reference.symbols,
      typeOnly: reference.typeOnly,
    };
    if (!target)
      return { ...relationship, unresolved: 'Module is outside captured compiler resolution' };
    const path = this.program.path(target);
    const destination = this.owners.find((component) => covered(path, component.allowedWritePaths));
    if (!destination) throw new Error(`Resolved import has no captured owner: ${path}`);
    if (destination.id !== owner.id) this.boundary(destination, source, path, reference.symbols);
    return { ...relationship, target: path, owner: destination.id };
  }

  /** Named API entries expose only their selected exports, including when namespace values escape. */
  private boundary(owner: Component, source: string, path: string, symbols: string[]): void {
    if (owner.schemaVersion !== 5) {
      if (!owner.ownership?.publicModules.includes(path))
        throw new Error(`Private cross-owner import: ${source} -> ${path}`);
      return;
    }
    const entries = owner.publicApi?.filter((entry) => entry.module === path) ?? [];
    if (!entries.length) throw new Error(`Private cross-owner import: ${source} -> ${path}`);
    const allowed = new Set(entries.flatMap((entry) => entry.exports.map((symbol) => symbol.name)));
    const module = this.program.checker.getSymbolAtLocation(this.program.source(path));
    const requested =
      symbols.includes('*') && module
        ? this.program.checker.getExportsOfModule(module).map((symbol) => symbol.name)
        : symbols;
    for (const name of requested)
      if (!allowed.has(name))
        throw new Error(`Private cross-owner symbol: ${source} -> ${path}:${name}`);
  }
}
