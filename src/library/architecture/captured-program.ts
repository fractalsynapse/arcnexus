import { CapturedOptions } from './captured-options.js';
import ts from 'typescript';
import { posix } from 'node:path';
import type { Component } from './components.js';
import { RevisionArtifacts } from './revision-artifacts.js';

/** Constructs a TypeScript program exclusively from captured maintained source bytes. */
export class CapturedProgram {
  private readonly root = '/arcnexus-captured';

  private readonly files = new Map<string, string>();

  readonly program: ts.Program;

  readonly checker: ts.TypeChecker;

  /** Captures source once per repository without reading editable generated output or candidate files. */
  constructor(owners: Component[], artifacts: RevisionArtifacts, packageRoot = '.') {
    for (const file of owners.flatMap((owner) => owner.inventory ?? [])) {
      if (!/\.[cm]?[jt]sx?$|\.json$/.test(file.path)) continue;
      this.files.set(posix.join(this.root, file.path), artifacts.read(file.path).text);
    }
    const options = new CapturedOptions(this.files, this.root).resolve(packageRoot);
    const sources = [...this.files.keys()].filter((path) => /\.[cm]?[jt]sx?$/.test(path));
    this.program = ts.createProgram(sources, options, this.host(options));
    this.checker = this.program.getTypeChecker();
  }

  /** Retrieves a captured module without resolving outside the immutable source map. */
  source(path: string): ts.SourceFile {
    const source = this.program.getSourceFile(posix.join(this.root, path));
    if (!source) throw new Error(`Unsupported or missing public source module: ${path}`);
    return source;
  }

  /** Converts compiler locations back into repository-relative evidence paths. */
  path(file: ts.SourceFile): string {
    return posix.relative(this.root, file.fileName);
  }

  /** Resolves source imports using captured aliases and declared compiler output mapping. */
  resolve(from: ts.SourceFile, specifier: string): ts.SourceFile | undefined {
    const resolved = this.module(specifier, from.fileName, this.program.getCompilerOptions());
    return resolved ? this.program.getSourceFile(resolved.resolvedFileName) : undefined;
  }

  /** Maps generated module imports back to maintained source using captured rootDir/outDir declarations. */
  private module(
    name: string,
    from: string,
    options: ts.CompilerOptions,
  ): ts.ResolvedModuleFull | undefined {
    const host = this.host(options);
    const direct = ts.resolveModuleName(name, from, options, host).resolvedModule;
    if (direct || !name.startsWith('.') || !options.outDir || !options.rootDir) return direct;
    const path = posix.normalize(posix.join(posix.dirname(from), name));
    if (!path.startsWith(options.outDir + '/')) return;
    const source = posix.join(options.rootDir, posix.relative(options.outDir, path));
    return ts.resolveModuleName(source, from, options, host).resolvedModule;
  }

  /** Preserves unresolved module diagnostics instead of claiming an empty external public surface. */
  unresolved(source: ts.SourceFile) {
    return this.program
      .getSemanticDiagnostics(source)
      .filter((diagnostic) => [2307, 7016, 2792].includes(diagnostic.code))
      .map((diagnostic) => ({
        path: this.path(source),
        line: source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
        reason: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      }));
  }

  /** Disables compiler filesystem fallbacks so dependencies cannot come from the current checkout. */
  private host(options: ts.CompilerOptions): ts.CompilerHost {
    return {
      ...ts.createCompilerHost(options, true),
      getCurrentDirectory: () => this.root,
      resolveModuleNames: (names, from) => names.map((name) => this.module(name, from, options)),
      fileExists: (path) => this.files.has(posix.normalize(path)),
      readFile: (path) => this.files.get(posix.normalize(path)),
      directoryExists: (path) => [...this.files.keys()].some((file) => file.startsWith(path + '/')),
      getDirectories: () => [],
      realpath: (path) => posix.normalize(path),
      getSourceFile: (path, version) => {
        const text = this.files.get(posix.normalize(path));
        return text === undefined ? undefined : ts.createSourceFile(path, text, version, true);
      },
      writeFile: () => {
        throw new Error('Captured architecture analysis cannot emit files');
      },
    };
  }
}
