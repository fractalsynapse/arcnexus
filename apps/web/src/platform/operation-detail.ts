import { createElement as h } from 'react';
import { DialogButton, JsonView } from '../../../../packages/ui/src/index.js';
import { useResource } from './resource.js';
import { usePlatformSession } from './session.js';

interface EvidenceLocation {
  sequence: string;
  execution: string;
  phase?: string;
}

/** Inspect the complete observations for one operation. */
export function OperationDetail({
  operation,
  ...location
}: EvidenceLocation & { operation: string }) {
  return h(DialogButton, {
    icon: 'info',
    title: operation + ' inputs and outputs',
    children: h(Evidence, location),
  });
}

function Evidence({ sequence, execution, phase }: EvidenceLocation) {
  const { project } = usePlatformSession();
  const path = project
    ? '/projects/' +
      project.id +
      '/operation-evidence/' +
      sequence +
      '?execution=' +
      encodeURIComponent(execution)
    : undefined;
  const evidence = useResource<{ entries: unknown[] }>(path, phase);
  if (evidence.error) return h('p', { role: 'alert' }, evidence.error);
  if (!evidence.value) return h('p', { role: 'status' }, 'Loading recorded tool evidence…');
  return h(
    'div',
    { className: 'arc-platform-stack' },
    evidence.value.entries.map((entry, index) => h(RecordedObservation, { key: index, entry })),
  );
}

function RecordedObservation({ entry }: { entry: unknown }) {
  const phase = entry && typeof entry === 'object' && 'phase' in entry ? entry.phase : undefined;
  const title =
    phase === 'started'
      ? 'Input'
      : phase === 'completed'
        ? 'Output'
        : phase === 'refused'
          ? 'Error'
          : 'Observation';
  return h('section', null, h('h3', null, title), h(JsonView, { value: entry }));
}
