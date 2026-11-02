import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { InputError } from '../architecture/config.js';

/** Resolves application storage without confusing machine settings with architectural authority. */
export class ApplicationSettings {
  private readonly path = join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
    'arcnexus',
    'config.json',
  );

  /** Returns effective volume selection without creating directories on reads. */
  get(name: string) {
    if (name !== 'volume') throw new InputError('Unknown application setting: ' + name);
    const configured = this.read().volume;
    const fallback = join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share'), 'arcnexus');
    return {
      name,
      value: resolve(process.env.ARCNEXUS_VOLUME ?? configured ?? fallback),
      source: process.env.ARCNEXUS_VOLUME
        ? 'environment'
        : configured
          ? 'configuration'
          : 'default',
    };
  }

  /** Atomically saves explicit machine configuration; environment overrides remain visible. */
  update(name: string, value: string) {
    if (name !== 'volume' || !value.trim()) throw new InputError('Expected a nonempty volume path');
    const data = { ...this.read(), volume: resolve(value) };
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = this.path + '.' + randomUUID();
    writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
    renameSync(temporary, this.path);
    return { ...this.get(name), configuredValue: data.volume };
  }

  /** Refuses unknown persisted settings rather than silently interpreting architectural policy. */
  private read(): { volume?: string } {
    if (!existsSync(this.path)) return {};
    const data: unknown = JSON.parse(readFileSync(this.path, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new InputError('Invalid application configuration');
    if (Object.keys(data).some((key) => key !== 'volume'))
      throw new InputError('Unknown application configuration field');
    const volume = (data as { volume?: unknown }).volume;
    if (volume !== undefined && (typeof volume !== 'string' || !volume.trim()))
      throw new InputError('Invalid configured volume');
    return data as { volume?: string };
  }
}
