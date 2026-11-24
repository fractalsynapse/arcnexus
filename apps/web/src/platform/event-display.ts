import { OperationDetail } from './operation-detail.js';
import { createElement as h } from 'react';
import { Button } from '../../../../packages/ui/src/index.js';
import { useResource } from './resource.js';
import { usePlatformSession } from './session.js';
import type { TimelineFrame } from './timeline-stream.js';
import { useTimeline } from './use-timeline.js';

type Entry = { message?: string; key: string; operations: TimelineFrame[] };

export function EventDisplay() {
  const { project, token } = usePlatformSession();
  const base = project && '/projects/' + project.id + '/plan-executions/';
  const current = useResource<{ execution?: string }>(base && base + 'current', token);
  const execution = current.value?.execution;
  const timeline = useTimeline(
    base && execution ? base + encodeURIComponent(execution) + '/events' : undefined,
    token,
  );
  if (!project) return h('p', null, 'Select a project to see planning events.');
  if (current.error) return h('p', { role: 'alert' }, current.error);
  if (current.value && !execution) return h('p', null, 'No recorded planning execution.');
  return h(
    'div',
    { className: 'arc-platform-stack' },
    timeline.error &&
      h(
        'div',
        null,
        h('p', { role: 'status' }, timeline.error),
        h(Button, { onClick: timeline.reconnect }, 'Reconnect'),
      ),
    h(
      'div',
      { role: 'log', 'aria-label': 'Planning events' },
      entries(timeline.frames).map((entry) => h(EventEntry, { key: entry.key, entry, execution })),
    ),
  );
}

function EventEntry({ entry, execution }: { entry: Entry; execution?: string }) {
  return h(
    'div',
    { className: 'arc-platform-stack' },
    entry.message && h('p', { className: 'arc-plan-message' }, entry.message),
    entry.operations.length > 0 &&
      h(
        'details',
        null,
        h('summary', null, entry.operations.length + ' recorded events'),
        h(
          'ul',
          null,
          entry.operations.map((operation) =>
            h(OperationEntry, { key: operation.sequence, operation, execution }),
          ),
        ),
      ),
  );
}

function OperationEntry({
  operation,
  execution,
}: {
  operation: TimelineFrame;
  execution?: string;
}) {
  const name = toolName(operation.observation);
  return h(
    'li',
    null,
    h('code', null, eventLabel(operation.observation)),
    execution &&
      name &&
      h(OperationDetail, { sequence: operation.sequence, execution, operation: name }),
  );
}

function entries(frames: TimelineFrame[]) {
  const groups: Entry[] = [];
  for (const frame of frames) {
    const message = modelMessage(frame.observation);
    if (message) groups.push({ key: frame.sequence, message, operations: [] });
    else {
      if (!groups.length) groups.push({ key: frame.sequence, operations: [] });
      groups.at(-1)!.operations.push(frame);
    }
  }
  return groups;
}

type Observation = {
  message?: string;
  operation?: { name?: string };
  nativeEvent?: {
    kind?: string;
    event?: { type?: string; item?: { type?: string; text?: string; tool?: string } };
  };
  outcome?: { kind?: string; summary?: string; reason?: string };
};

function modelMessage(value: unknown) {
  const observation = value as Observation | null;
  const event = observation?.nativeEvent?.event;
  const text = event?.item?.type === 'agent_message' ? event.item.text : undefined;
  return (
    text ??
    observation?.message ??
    observation?.outcome?.summary ??
    observation?.outcome?.reason ??
    observation?.outcome?.kind
  );
}

function toolName(value: unknown) {
  return (value as Observation | null)?.operation?.name;
}

function eventLabel(value: unknown) {
  const observation = value as Observation | null;
  const native = observation?.nativeEvent;
  return (
    toolName(value) ??
    native?.event?.item?.tool ??
    native?.event?.item?.type ??
    native?.event?.type ??
    (observation && Object.keys(observation).join(', ')) ??
    'Observation'
  );
}
