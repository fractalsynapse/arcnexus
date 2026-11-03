import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import type { CodexInput } from './codex-configuration.js';

const disabledFeatures = [
  'apps',
  'computer_use',
  'plugins',
  'hooks',
  'browser_use',
  'browser_use_external',
  'in_app_browser',
  'multi_agent',
  'multi_agent_v2',
];

const configuration = [
  'cli_auth_credentials_store="file"',
  '[features]',
  ...disabledFeatures.map((feature) => `${feature}=false`),
  '',
].join('\n');

/** Retains client threads and authentication without importing personal executable configuration. */
export class ClientHome {
  readonly path: string;

  readonly storage: string;

  readonly disabledFeatures = disabledFeatures;

  readonly personal = resolve(process.env.CODEX_HOME ?? join(homedir(), '.codex'));

  /** Rejects legacy continuation and unsafe storage before establishing private client authority. */
  constructor(input: CodexInput) {
    if (!/^[a-zA-Z0-9_-]+$/.test(input.record.id)) throw new Error('Invalid client identity');
    this.storage = join(resolve(input.root), 'private');
    this.path = join(this.storage, 'steward');
    this.sourceBoundary(input.record.workspace);
    const settings = input.record.settings as { clientProtocol?: number } | undefined;
    if (input.resumeId && (settings?.clientProtocol !== 1 || !existsSync(this.path)))
      throw new Error('Legacy model thread requires a new task under private client authority');
    const retained = existsSync(this.path);
    this.safePath(this.path);
    mkdirSync(this.path, { recursive: true, mode: 0o700 });
    if (!retained) this.initialize();
    this.validate();
    this.authentication();
  }

  /** Pins the authentication source once; changing identities requires distinct private state. */
  private initialize(): void {
    writeFileSync(join(this.path, 'config.toml'), configuration, { flag: 'wx', mode: 0o600 });
    writeFileSync(join(this.path, 'binding.json'), JSON.stringify({ source: this.personal }), {
      flag: 'wx',
      mode: 0o600,
    });
  }

  /** Rejects source overlap before creating directories or copying authentication material. */
  private sourceBoundary(workspace: string): void {
    const source = realpathSync(workspace);
    for (const suffix of [relative(source, this.storage), relative(this.storage, source)])
      if (suffix === '' || (!suffix.startsWith('../') && suffix !== '..'))
        throw new Error('Private client storage must be outside maintained source');
  }

  /** Rejects configuration drift rather than silently replacing an active client's authority. */
  validate(): void {
    this.safePath(this.path);
    const path = join(this.path, 'config.toml');
    this.safePath(path);
    const binding = join(this.path, 'binding.json');
    this.safePath(binding);
    if (
      !existsSync(binding) ||
      readFileSync(binding, 'utf8') !== JSON.stringify({ source: this.personal })
    )
      throw new Error('Private client authentication binding changed; use distinct runtime state');
    if (!existsSync(path) || readFileSync(path, 'utf8') !== configuration)
      throw new Error('Private client configuration changed; retain evidence and start a new task');
  }

  /** Seeds only file authentication; subsequent refreshes belong to this private client. */
  private authentication(): void {
    const target = join(this.path, 'auth.json');
    this.safePath(target);
    if (existsSync(target)) return;
    const source = join(this.personal, 'auth.json');
    this.safePath(source);
    if (existsSync(source))
      writeFileSync(target, readFileSync(source), { flag: 'wx', mode: 0o600 });
  }

  /** Refuses symbolic and hard-linked authority paths without following an attacker-selected alias. */
  private safePath(path: string): void {
    let current = '/';
    for (const segment of resolve(path).split('/').filter(Boolean)) {
      current = join(current, segment);
      try {
        const stat = lstatSync(current);
        if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1))
          throw new Error('Unsafe private client authority path');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
    }
  }
}
