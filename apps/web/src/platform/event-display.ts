import { createElement as h } from 'react';
import { Button, type CommandBinding } from '../../../../packages/ui/src/index.js';
import { EventEntry } from './event-entry.js';
import { usePlanResource } from './plan-resource.js';
import { groupTimeline } from './timeline-groups.js';
import { useTimeline } from './use-timeline.js';
import { useTimelineTail } from './timeline-tail.js';

/** Follow the selected Plan and display only its ordered, retained observations. */
export function EventDisplay({ binding }: { binding: CommandBinding }) {
  const { project, history, events, execution, command, active, recorded } = usePlanResource();
  const timeline = useTimeline(events && events + '/events');
  const tail = useTimelineTail(events, active, timeline.frames.at(-1)?.sequence);
  if (!project) return h('p', null, 'Select a project to see planning events.');
  if (history.error && !events) return h('p', { role: 'alert' }, history.error);
  if (history.value && !execution) return h('p', null, 'No recorded planning execution.');
  return h(
    'div',
    { className: 'arc-platform-stack' },
    timeline.error && h(StreamNotice, { message: timeline.error, reconnect: timeline.reconnect }),
    h(
      'div',
      {
        role: 'log',
        'aria-label': 'Planning events',
        className: 'arc-plan-timeline',
        tabIndex: 0,
        ...tail,
      },
      groupTimeline(timeline.frames, execution, recorded?.attempt).map((entry) =>
        h(EventEntry, { key: entry.key, entry, execution, command, binding }),
      ),
    ),
  );
}

function StreamNotice({ message, reconnect }: { message: string; reconnect: () => void }) {
  return h(
    'div',
    { className: 'arc-platform-inline' },
    h('p', { role: 'status' }, message),
    h(Button, { onClick: reconnect }, 'Reconnect'),
  );
}
