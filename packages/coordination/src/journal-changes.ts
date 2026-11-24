import { EventEmitter, on } from 'node:events';
import { existsSync, watch } from 'node:fs';
import { dirname, relative } from 'node:path';
import { journalPath } from './journal-path.js';

function watchRoot(directory: string): string {
  return existsSync(directory) ? directory : watchRoot(dirname(directory));
}

/** Start observing before replay. Only treat filesystem changes as a prompt to reread committed rows. */
export function journalChanges(storage: string, remote: string, signal: AbortSignal) {
  const journal = journalPath(storage, remote);
  const directory = dirname(journal);
  const root = watchRoot(directory);
  const file = relative(root, journal);
  const project = relative(root, directory);
  const emitter = new EventEmitter();
  const notices = on(emitter, 'change', { signal });
  const watcher = watch(root, { recursive: root !== directory, signal }, (_kind, filename) => {
    if (
      !filename ||
      filename === file ||
      filename === file + '-journal' ||
      filename === file + '-wal' ||
      filename === project
    )
      emitter.emit('change');
  });
  watcher.on('error', (error) => emitter.emit('error', error));
  return notices as AsyncIterator<void>;
}
