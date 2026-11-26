import { createElement as h } from 'react';
import { usePlanFile } from './plan-file-scope.js';

/** Identify the repository path above the file displays. */
export function FilePath() {
  const { detail, revisions } = usePlanFile();
  const path = detail.value?.entry.path;
  return h(
    'div',
    { className: 'arc-file-path-row' },
    path && h('code', { className: 'arc-file-path' }, path),
    revisions.captured.error && h('p', { role: 'alert' }, revisions.captured.error),
  );
}
