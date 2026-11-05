import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { relativePath, type Command } from '../architecture/config.js';
import { git } from './process.js';
import { executablePath } from './executable.js';

const diagnosticSupport = readFileSync(new URL('./node-stdio.js', import.meta.url), 'utf8');

export interface ConfinementAuthority {
  workspace: string;
  reads: string[];
  outputs: string[];
  readOnlyOutputs?: string[];
  maintainedPaths?: string[];
  network?: boolean | { domains: string[] };
  temporaryRoot: string;
  executable: string;
  toolDirectories?: string[];
  protectedPaths?: string[];
}

/** Builds an enforced read-only source policy with narrowly declared disposable output mounts. */
export class SourceConfinement {
  readonly filesystem: Record<string, 'read' | 'write' | 'deny'> = {
    ':minimal': 'read',
    '/sys/fs/cgroup': 'read',
  };

  readonly overrides: string[];

  readonly temporaryRoot: string;

  readonly workspace: string;

  /** Validates all aliases and output intersections before creating writable sandbox roots. */
  constructor(private readonly authority: ConfinementAuthority) {
    this.workspace = realpathSync(authority.workspace);
    this.temporaryRoot = resolve(authority.temporaryRoot);
    if (
      this.inside(this.temporaryRoot, this.workspace) ||
      this.inside(this.workspace, this.temporaryRoot)
    )
      throw new Error('Private temporary storage must be outside source');
    this.validateSource();
    const protectedOutputs = (authority.readOnlyOutputs ?? []).map((path) => this.output(path));
    const outputs = authority.outputs
      .map((path) => this.output(path))
      .filter((path) => !protectedOutputs.some((root) => this.inside(path, root)));
    if (outputs.some((path) => protectedOutputs.some((root) => this.inside(root, path))))
      throw new Error('Writable output contains prepared dependencies');
    for (const path of authority.reads) this.read(path);
    for (const path of authority.toolDirectories ?? []) this.tool(path);
    if (authority.network && existsSync('/etc/resolv.conf')) this.tool('/etc/resolv.conf');
    for (const path of [...outputs, this.temporaryRoot]) {
      this.validateSegments(path);
      mkdirSync(path, { recursive: true, mode: 0o700 });
      this.filesystem[path] = 'write';
      this.disposableChildren(path);
    }
    for (const path of protectedOutputs) this.filesystem[path] = 'read';
    this.configurationHome();
    for (const path of authority.protectedPaths ?? []) this.protect(path);
    this.overrides = this.configuration();
  }

  /** Keeps disposable root cleanup possible without exposing source metadata or following output aliases. */
  private disposableChildren(root: string): void {
    for (const name of ['.agents', '.codex', '.aws', '.git']) {
      const path = join(root, name);
      this.validateSegments(path);
      this.filesystem[path] = 'write';
    }
  }

  /** Pins configuration read-only explicitly; the installed runtime otherwise grants its home writes. */
  private configurationHome(): void {
    const path = this.temporaryRoot + '-configuration';
    if (this.inside(path, this.workspace) || this.inside(this.workspace, path))
      throw new Error('Private configuration must be outside source');
    this.validateSegments(path);
    mkdirSync(path, { recursive: true, mode: 0o700 });
    this.captureSupport(join(path, 'node-stdio.mjs'));
    this.filesystem[path] = 'read';
  }

  /** Keeps trusted support independent of candidate builds and refuses altered or aliased snapshots. */
  private captureSupport(path: string): void {
    this.validateSegments(path);
    if (existsSync(path)) {
      if (lstatSync(path).nlink !== 1 || readFileSync(path, 'utf8') !== diagnosticSupport)
        throw new Error('Runtime support snapshot changed: ' + path);
      return;
    }
    writeFileSync(path, diagnosticSupport, { flag: 'wx', mode: 0o400 });
  }

  /** Denies host-private authority independently of implicit runtime configuration-home grants. */
  private protect(path: string): void {
    const absolute = resolve(path);
    this.validateSegments(absolute);
    if (this.inside(this.workspace, absolute) || this.inside(absolute, this.workspace))
      throw new Error('Private execution authority overlaps source');
    this.filesystem[absolute] = 'deny';
  }

  /** Prevents executable bindings from implicitly granting filesystem-wide read access. */
  private tool(path: string): void {
    const canonical = realpathSync(path);
    if (canonical === '/') throw new Error('Tool directory cannot be the filesystem root');
    this.filesystem[canonical] = 'read';
  }

  /** Resolves the declared program before wrapping it, without changing aliases or granting new filesystem access. */
  command(command: Command, cwd = this.workspace, path = process.env.PATH): Command {
    const actual = realpathSync(cwd);
    this.rejectConfiguration(actual);
    if (!this.inside(actual, this.workspace)) throw new Error('Operation cwd escapes source');
    const args = ['sandbox', '-P', 'arcnexus', '-C', actual];
    for (const override of this.overrides) args.push('-c', override);
    return {
      command: this.authority.executable,
      args: [...args, '--', executablePath(command.command, actual, path), ...command.args],
    };
  }

  /** Rejects ignored project settings along the actual command path before policy resolution. */
  private rejectConfiguration(cwd: string): void {
    let current = cwd;
    while (this.inside(current, this.workspace)) {
      if (existsSync(join(current, '.codex/config.toml')))
        throw new Error('Target Codex configuration cannot alter execution confinement');
      if (current === this.workspace) break;
      current = resolve(current, '..');
    }
  }

  /** Uses private configuration and temporary storage instead of caller-writable configuration. */
  environment(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    return {
      ...base,
      HOME: this.temporaryRoot,
      CODEX_HOME: this.temporaryRoot + '-configuration',
      TMPDIR: this.temporaryRoot,
      NODE_OPTIONS:
        '--require ' +
        JSON.stringify(join(this.temporaryRoot + '-configuration', 'node-stdio.mjs')),
    };
  }

  /** Rejects tracked aliases and target configuration that could override the active policy. */
  private validateSource(): void {
    const files = git(
      this.workspace,
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
    )
      .split('\0')
      .filter(Boolean);
    for (const file of files) {
      if (file === '.codex/config.toml' || file.endsWith('/.codex/config.toml'))
        throw new Error('Target Codex configuration cannot alter execution confinement');
      const path = join(this.workspace, file);
      this.validateSegments(path);
      if (existsSync(path) && lstatSync(path).isFile() && lstatSync(path).nlink !== 1)
        throw new Error(`Maintained source has an unsafe hard link: ${file}`);
    }
  }

  /** Validates source/output separation against the Git index before filesystem creation. */
  private output(path: string): string {
    relativePath(path);
    const tracked = [
      ...git(this.workspace, 'ls-files', '-z').split('\0').filter(Boolean),
      ...(this.authority.maintainedPaths ?? []),
    ];
    if (tracked.some((file) => this.inside(file, path) || this.inside(path, file)))
      throw new Error(`Generated output overlaps tracked source: ${path}`);
    const absolute = resolve(this.workspace, path);
    this.validateSegments(absolute);
    return absolute;
  }

  /** Grants only existing read paths; ownership of future files does not require creating them. */
  private read(path: string): void {
    if (path !== '.') relativePath(path);
    const absolute = resolve(this.workspace, path);
    this.validateSegments(absolute);
    if (existsSync(absolute)) this.filesystem[absolute] = 'read';
  }

  /** Rejects filesystem aliases in existing ancestors, including dangling symlinks. */
  private validateSegments(path: string): void {
    const parts = resolve(path).split('/').filter(Boolean);
    let current = '/';
    for (const part of parts) {
      current = join(current, part);
      try {
        if (lstatSync(current).isSymbolicLink()) throw new Error(`Unsafe symlink: ${current}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
    }
  }

  /** Distinguishes containment from sibling path prefixes. */
  private inside(path: string, root: string): boolean {
    const suffix = relative(root, path);
    return (
      suffix === '' || (!suffix.startsWith('../') && suffix !== '..' && !suffix.startsWith('/'))
    );
  }

  /** Uses a deny-all proxy for no-network work, preserving local stdio without granting network destinations. */
  private networkConfiguration(): string[] {
    const network = this.authority.network;
    if (network === true) return [];
    const allowed = network && typeof network === 'object' ? network.domains : [];
    if (
      (typeof network === 'object' && !allowed.length) ||
      allowed.some((domain) => !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain))
    )
      throw new Error('Expected explicit operation network domains');
    const domains = allowed.map((domain) => `${JSON.stringify(domain)}="allow"`);
    return [
      'features.network_proxy=true',
      'permissions.arcnexus.network.mode="limited"',
      `permissions.arcnexus.network.domains={${domains.join(',')}}`,
    ];
  }

  /** Encodes literal TOML values with no shell interpolation or inherited writable defaults. */
  private configuration(): string[] {
    const entries = Object.entries(this.filesystem).map(
      ([path, mode]) => `${JSON.stringify(path)}=${JSON.stringify(mode)}`,
    );
    return [
      'default_permissions="arcnexus"',
      `permissions.arcnexus.filesystem={${entries.join(',')}}`,
      'permissions.arcnexus.network.enabled=true',
      ...this.networkConfiguration(),
      'features.use_legacy_landlock=false',
    ];
  }
}
