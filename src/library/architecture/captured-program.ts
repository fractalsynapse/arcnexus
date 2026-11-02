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
  constructor(owners: Component[], artifacts: RevisionArtifacts) {
    for (const file of owners.flatMap((owner) => owner.inventory ?? [])) {
      if (!/\.[cm]?[jt]sx?$/.test(file.path)) continue;
      this.files.set(posix.join(this.root, file.path), artifacts.read(file.path).text);
    }
    const options: ts.CompilerOptions = {
      noLib: true,
      types: [],
      allowJs: true,
      checkJs: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
    };
    this.program = ts.createProgram([...this.files.keys()], options, this.host(options));
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
