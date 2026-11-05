import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { closeSync, lstatSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { format, getFileInfo, resolveConfig } from 'prettier';

/** Produces checked formatting proposals without exposing a maintained-source write path. */
export class FormattingProposal {
  /** Validates host-provided ownership paths before discovering maintained candidate files. */
  constructor(paths, included = paths) {
    if (!paths.length) throw new Error('Formatting requires captured owned paths');
    this.included = included;
    this.roots = paths.map((path) => {
      const normalized = relative(process.cwd(), resolve(path));
      if (isAbsolute(path) || normalized === '..' || normalized.startsWith('..' + sep))
        throw new Error('Formatting path escapes the package');
      return normalized.split(sep).join('/') || '.';
    });
  }

  /** Returns one stable transaction identity for an identical set of proposed replacements. */
  async create() {
    const paths = this.paths();
    const changes = [];
    for (const path of [...new Set(paths)].sort()) {
      if (!this.roots.some((root) => root === '.' || path === root || path.startsWith(root + '/')))
        continue;
      if (
        !this.included.some((root) => root === '.' || path === root || path.startsWith(root + '/'))
      )
        continue;
      const change = await this.change(path);
      if (change) changes.push(change);
    }
    const id = 'format-' + createHash('sha256').update(JSON.stringify(changes)).digest('hex');
    return { id, changes };
  }

  /** Captures Git discovery through a private file, avoiding network-sandbox socket-backed pipes. */
  paths() {
    const directory = mkdtempSync(resolve(tmpdir(), 'format-proposal-'));
    const output = resolve(directory, 'paths');
    const descriptor = openSync(output, 'wx', 0o600);
    try {
      execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
        stdio: ['ignore', descriptor, 'inherit'],
      });
      return readFileSync(output, 'utf8').split('\0').filter(Boolean);
    } finally {
      closeSync(descriptor);
      rmSync(directory, { recursive: true, force: true });
    }
  }

  /** Refuses aliases and preserves ignored or unsupported files; all formatting stays in memory. */
  async change(path) {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (!stat) return undefined;
    if (!stat.isFile() || stat.nlink !== 1) throw new Error('Unsafe formatting source: ' + path);
    const info = await getFileInfo(path, { ignorePath: '.prettierignore' });
    if (info.ignored || !info.inferredParser) return undefined;
    const before = readFileSync(path);
    const content = await format(before.toString('utf8'), {
      ...(await resolveConfig(path)),
      filepath: path,
    });
    if (before.equals(Buffer.from(content))) return undefined;
    return {
      path,
      operation: 'update',
      expectedSha256: createHash('sha256').update(before).digest('hex'),
      content,
    };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(JSON.stringify(await new FormattingProposal(process.argv.slice(2)).create()));
