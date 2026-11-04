import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Bindings, RepositoryMaterialization } from './bindings.js';
import { git } from '../operations/process.js';

/** Records host materialization identity in private linked-worktree metadata for fresh CLI discovery. */
export class MaterializationBindings {
  /** Captures only the mapping for this worktree, leaving source authority and ordinary bindings unchanged. */
  capture(workspace: string, bindings: Bindings): { path: string; sha256: string } | undefined {
    const commonDir = realpathSync(
      git(workspace, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim(),
    );
    const entries = Object.entries(bindings.materializations ?? {}).filter(
      ([, entry]) => entry.commonDir === commonDir,
    );
    if (!entries.length) return undefined;
    if (entries.length !== 1) throw new Error('Ambiguous worktree materialization identity');
    const [id, entry] = entries[0]!;
    const materialization = {
      ...entry,
      source: realpathSync(workspace),
      base: git(workspace, 'rev-parse', 'HEAD').trim(),
    };
    const text = JSON.stringify({ schemaVersion: 1, materializations: { [id]: materialization } });
    const path = this.path(workspace);
    if (!path) throw new Error('Materialization discovery requires a linked worktree');
    mkdirSync(join(path, '..'), { recursive: true, mode: 0o700 });
    writeFileSync(path, text, { flag: 'wx', mode: 0o400 });
    return { path, sha256: createHash('sha256').update(text).digest('hex') };
  }

  /** Reads only an immutable regular metadata file; caller validates its actual Git identity before use. */
  read(workspace: string): Record<string, RepositoryMaterialization> {
    const path = this.path(workspace);
    if (!path || !existsSync(path)) return {};
    const info = lstatSync(path);
    if (!info.isFile() || info.nlink !== 1 || realpathSync(path) !== path)
      throw new Error('Unsafe worktree materialization metadata');
    const value = JSON.parse(readFileSync(path, 'utf8'));
    if (
      value.schemaVersion !== 1 ||
      !value.materializations ||
      typeof value.materializations !== 'object' ||
      Array.isArray(value.materializations) ||
      Object.keys(value.materializations).length !== 1 ||
      Object.keys(value).some((key) => !['schemaVersion', 'materializations'].includes(key))
    )
      throw new Error('Invalid worktree materialization metadata');
    return value.materializations;
  }

  /** Resolves metadata outside maintained source and refuses ordinary checkout or aliased directories. */
  private path(workspace: string): string | undefined {
    const directory = git(workspace, 'rev-parse', '--absolute-git-dir').trim();
    const common = git(workspace, 'rev-parse', '--path-format=absolute', '--git-common-dir').trim();
    if (directory === common) return undefined;
    if (realpathSync(directory) !== directory) throw new Error('Aliased worktree metadata');
    const parent = join(directory, 'arcnexus');
    if (existsSync(parent) && realpathSync(parent) !== parent)
      throw new Error('Aliased materialization metadata directory');
    return join(parent, 'materialization.json');
  }
}
