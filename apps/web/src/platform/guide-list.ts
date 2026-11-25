import { createElement as h } from 'react';
import { Tooltip, WorkspaceLink } from '../../../../packages/ui/src/index.js';
import { guideLink, type Guide, type GuideKind } from './guide.js';

interface ListProps {
  entries: readonly Guide[];
  kind: GuideKind;
  revision: string;
  changed: ReadonlySet<string>;
}

/** Present the compact, linked file rows and their retained change status. */
export function GuideList({ entries, kind, revision, changed }: ListProps) {
  if (!entries.length) return h('p', { role: 'status' }, 'No files match these filters.');
  return h(
    'ul',
    { className: 'arc-guide-list', 'aria-label': 'Plan files' },
    entries.map((entry) =>
      h(GuideRow, { key: entry.id, entry, kind, revision, changed: changed.has(entry.path) }),
    ),
  );
}

function GuideRow({
  entry,
  kind,
  revision,
  changed,
}: Omit<ListProps, 'entries' | 'changed'> & { entry: Guide; changed: boolean }) {
  const link = h(WorkspaceLink, { href: guideLink(kind, entry.id, revision) }, entry.id);
  const description = entry.description ?? entry.name ?? entry.path;
  return h(
    'li',
    { className: 'arc-guide-row', 'data-changed': changed ? '' : undefined },
    h(Tooltip, { label: description }, link),
    entry.priority !== undefined &&
      h(
        'span',
        { className: 'arc-guide-priority', 'aria-label': 'Priority ' + entry.priority },
        entry.priority,
      ),
    h(
      'span',
      { className: 'arc-guide-topics' },
      entry.topics?.map((topic) => h('small', { key: topic }, topic)),
    ),
    entry.updated &&
      h('time', { dateTime: entry.updated }, new Date(entry.updated).toLocaleDateString()),
    changed && h('small', { className: 'arc-guide-changed' }, 'Changed'),
  );
}
