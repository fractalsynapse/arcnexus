import { createElement as h } from 'react';
import { DiffView } from '../../../../packages/ui/src/index.js';
import type { GuideDifference } from './guide.js';
import { usePlanFile } from './plan-file-scope.js';
import { useResource } from './resource.js';

/** Read the diff only while its panel is mounted, using the file's pinned source. */
export function FileChanges() {
  const { base, query, token, editing, detail, draft } = usePlanFile();
  const changes = useResource<GuideDifference>(
    base && !editing ? base + '/changes?' + query : undefined,
    token,
  );
  if (!base) return null;
  if (editing && detail.value) {
    const { content, entry } = detail.value;
    const after = draft ?? content;
    return h(DiffView, { files: [{ path: entry.path, before: content, after }] });
  }
  if (changes.error) return h('p', { role: 'alert' }, changes.error);
  if (!changes.value) return h('p', { role: 'status' }, 'Loading file changes…');
  return h(DiffView, { files: [changes.value] });
}
