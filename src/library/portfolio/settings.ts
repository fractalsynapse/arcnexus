import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { InputError } from '../architecture/config.js';
import { ExecutionLease } from '../coordination-store/execution-store.js';

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
    if (process.env.ARCNEXUS_VOLUME !== undefined && !process.env.ARCNEXUS_VOLUME.trim())
      throw new InputError('Expected a nonempty ARCNEXUS_VOLUME path');
    const fallback = join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share'), 'arcnexus');
    const result = {
      name,
      value: resolve(process.env.ARCNEXUS_VOLUME ?? configured ?? fallback),
      source: process.env.ARCNEXUS_VOLUME
        ? 'environment'
        : configured
          ? 'configuration'
          : 'default',
    };
    const revision = createHash('sha256')
      .update(JSON.stringify({ ...result, configuredValue: configured ?? null }))
      .digest('hex');
    return { ...result, revision };
  }

  /** Selects execution storage without moving historical evidence or creating directories. */
  statePath(volume?: string): string {
    const override = process.env.ARCNEXUS_STATE_DIR;
    if (override !== undefined) {
      if (!override.trim()) throw new InputError('Expected a nonempty ARCNEXUS_STATE_DIR path');
      return resolve(override);
    }
    return join(volume ?? this.get('volume').value, 'state');
  }

  /** Includes historical and explicitly selected stores when guarding repository removal. */
  executionRoots(volume: string): string[] {
    const historical = join(
      process.env.XDG_STATE_HOME ?? join(homedir(), '.local/state'),
      'arcnexus',
    );
    return [...new Set([join(volume, 'state'), this.statePath(volume), resolve(historical)])];
  }

  /** Atomically saves explicit machine configuration; environment overrides remain visible. */
  update(name: string, value: string, expectedRevision?: string) {
    if (name !== 'volume' || !value.trim()) throw new InputError('Expected a nonempty volume path');
    const lease = new ExecutionLease(
      this.path + '.lease.sqlite',
      'Application settings are being updated',
    );
    try {
      const current = this.get(name);
      if (expectedRevision !== undefined && current.revision !== expectedRevision)
        throw new InputError('Settings revision changed; read current settings before retrying');
      return this.persist(name, value);
    } finally {
      lease.close();
    }
  }

  /** Replaces the single authored settings source and removes any incomplete temporary file. */
  private persist(name: string, value: string) {
    const data = { ...this.read(), volume: resolve(value) };
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = this.path + '.' + randomUUID();
    try {
      writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      renameSync(temporary, this.path);
    } finally {
      rmSync(temporary, { force: true });
    }
    return { ...this.get(name), configuredValue: data.volume };
  }

  /** Refuses unknown persisted settings rather than silently interpreting architectural policy. */
  private read(): { volume?: string } {
    if (!existsSync(this.path)) return {};
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(this.path, 'utf8'));
    } catch {
      throw new InputError('Unreadable or malformed application configuration: ' + this.path);
    }
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
