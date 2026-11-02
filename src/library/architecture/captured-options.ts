import ts from 'typescript';
import { posix } from 'node:path';

/** Resolves compiler options from captured configuration without consulting machine-local packages. */
export class CapturedOptions {
  /** Retains the immutable file map shared by module analysis. */
  constructor(
    private readonly files: Map<string, string>,
    private readonly root: string,
  ) {}

  /** Uses the closest containing captured configuration and preserves local extends and alias semantics. */
  resolve(packageRoot: string): ts.CompilerOptions {
    const defaults = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
    };
    const path = this.configuration(packageRoot);
    const captured = path ? this.parse(path) : {};
    return { ...defaults, ...captured, noLib: true, types: [], allowJs: true, checkJs: true };
  }

  /** Finds only existing tracked configuration while walking toward the captured repository root. */
  private configuration(packageRoot: string): string | undefined {
    let directory = posix.join(this.root, packageRoot);
    while (directory.startsWith(this.root)) {
      const path = posix.join(directory, 'tsconfig.json');
      if (this.files.has(path)) return path;
      if (directory === this.root) return;
      directory = posix.dirname(directory);
    }
    return undefined;
  }

  /** Parses compiler JSON and relative extensions through the captured-only configuration host. */
  private parse(path: string): ts.CompilerOptions {
    const parsed = ts.parseConfigFileTextToJson(path, this.files.get(path)!);
    const configuration = ts.parseJsonConfigFileContent(
      parsed.config,
      {
        useCaseSensitiveFileNames: true,
        fileExists: (file) => this.files.has(posix.normalize(file)),
        readFile: (file) => this.files.get(posix.normalize(file)),
        readDirectory: (directory) =>
          [...this.files.keys()].filter((file) => file.startsWith(directory + '/')),
      },
      posix.dirname(path),
    );
    const errors = [parsed.error, ...configuration.errors].filter(
      (error) => error && error.code !== 18003,
    );
    if (errors.length)
      throw new Error(
        'Captured compiler configuration: ' +
          errors
            .map((error) => ts.flattenDiagnosticMessageText(error!.messageText, '\n'))
            .join('; '),
      );
    return configuration.options;
  }
}
