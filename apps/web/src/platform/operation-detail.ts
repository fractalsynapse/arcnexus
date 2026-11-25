import { createElement as h } from 'react';
import { DialogButton, JsonView } from '../../../../packages/ui/src/index.js';
import { useResource } from './resource.js';
import { usePlatformSession } from './session.js';

export function OperationDetail({
  sequence,
  execution,
  operation,
}: {
  sequence: string;
  execution: string;
  operation: string;
}) {
  return h(DialogButton, {
    icon: 'info',
    title: operation + ' inputs and outputs',
    children: h(Evidence, { sequence, execution }),
  });
}

function Evidence({ sequence, execution }: { sequence: string; execution: string }) {
  const { project, token } = usePlatformSession();
  const path = project
    ? '/projects/' +
      project.id +
      '/operation-evidence/' +
      sequence +
      '?execution=' +
      encodeURIComponent(execution)
    : undefined;
  const evidence = useResource<{ entries: unknown[] }>(path, token);
  if (evidence.error) return h('p', { role: 'alert' }, evidence.error);
  if (!evidence.value) return h('p', { role: 'status' }, 'Loading recorded tool evidence…');
  return h(
    'div',
    { className: 'arc-platform-stack' },
    evidence.value.entries.map((entry, index) => h(JsonView, { key: index, value: entry })),
  );
}
