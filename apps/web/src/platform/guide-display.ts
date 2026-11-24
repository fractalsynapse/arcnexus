import { createElement as h, useState } from 'react';
import { Button } from '../../../../packages/ui/src/index.js';
import { useResource } from './resource.js';
import { usePlatformSession } from './session.js';

type Guide = { id: string; path: string; priority?: number };
export type GuideKind = 'objectives' | 'goals';

/** Mount one guide collection independently of the other Plan displays. */
export function GuideDisplay({ kind }: { kind: GuideKind }) {
  const { token, project } = usePlatformSession();
  const [selected, select] = useState<{ project: string; id: string }>();
  const base = project ? '/projects/' + project.id + '/' + kind : undefined;
  const selection = useResource<{ revision?: string }>(
    project ? '/projects/' + project.id + '/plan-executions/current' : undefined,
    token,
  );
  const revision = project ? '?revision=' + (selection.value?.revision ?? project.revision) : '';
  const collection = useResource<{ entries: Guide[] }>(
    base && selection.value && base + revision,
    token,
  );
  const detailPath =
    base && selected && selected.project === project?.id
      ? base + '/' + encodeURIComponent(selected.id) + revision
      : undefined;
  const detail = useResource<{ content: string }>(detailPath, token);
  if (!project) return h('p', null, 'Select a project to view ' + kind + '.');
  if (selection.error) return h('p', { role: 'alert' }, selection.error);
  if (collection.error) return h('p', { role: 'alert' }, collection.error);
  if (!collection.value) return h('p', { role: 'status' }, 'Loading ' + kind + '…');
  return h(GuideEntries, {
    entries: collection.value.entries,
    select: (id) => select({ project: project.id, id }),
    detail,
    kind,
  });
}

function GuideEntries({
  entries,
  select,
  detail,
  kind,
}: {
  entries: Guide[];
  select(id: string): void;
  detail: { error?: string; value?: { content: string } };
  kind: GuideKind;
}) {
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h(
      'ul',
      null,
      entries.map(({ id }) => h('li', { key: id }, h(Button, { onClick: () => select(id) }, id))),
    ),
    !entries.length && h('p', null, 'No ' + kind + ' at the selected revision.'),
    detail.error && h('p', { role: 'alert' }, detail.error),
    detail.value && h('pre', { className: 'arc-guide-content' }, detail.value.content),
  );
}
