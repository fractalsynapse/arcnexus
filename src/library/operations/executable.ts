import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';

/** Resolves declared programs before sandbox dispatch, preserving executable PATH ordering and cwd semantics. */
export function executablePath(command: string, cwd: string, path = process.env.PATH): string {
  if (!command.includes('/') && !path)
    throw new Error('Executable lookup requires an execution PATH');
  const candidates = command.includes('/')
    ? [resolve(cwd, command)]
    : (path ?? '').split(delimiter).map((directory) => resolve(cwd, directory, command));
  for (const candidate of candidates) {
    try {
      if (!statSync(candidate).isFile()) continue;
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Like executable PATH lookup, an inaccessible entry does not hide a later valid program.
    }
  }
  throw new Error('Cannot resolve executable before confined dispatch: ' + command);
}
