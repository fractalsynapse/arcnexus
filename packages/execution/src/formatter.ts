import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Find the installed project formatter and reject aliases outside the resolved checkout. */
export function formatterPreview(root: string) {
  const entry = join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  if (!existsSync(entry) || realpathSync(entry) !== entry || !lstatSync(entry).isFile())
    return undefined;
  return { entry, root: dirname(dirname(entry)) };
}
