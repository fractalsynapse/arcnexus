import { createElement as h } from 'react';
import { Button, type CommandBinding } from '../../../../packages/ui/src/index.js';
import { EventEntry } from './event-entry.js';
import { usePlanResource } from './plan-resource.js';
import { groupTimeline } from './timeline-groups.js';
import { useTimeline } from './use-timeline.js';

/** Follow the selected Plan and display only its ordered, retained observations. */
export function EventDisplay({ binding }: { binding: CommandBinding }) {
  const { project, history, events, execution, command } = usePlanResource();
  const timeline = useTimeline(events && events + '/events');
  if (!project) return h('p', null, 'Select a project to see planning events.');
  if (history.error && !events) return h('p', { role: 'alert' }, history.error);
  if (history.value && !execution) return h('p', null, 'No recorded planning execution.');
  return h(
    'div',
    { className: 'arc-platform-stack' },
    timeline.error &&
      h(
        'div',
        { className: 'arc-platform-inline' },
        h('p', { role: 'status' }, timeline.error),
        h(Button, { onClick: timeline.reconnect }, 'Reconnect'),
      ),
    h(
      'div',
      { role: 'log', 'aria-label': 'Planning events', className: 'arc-plan-timeline' },
      groupTimeline(timeline.frames).map((entry) =>
        h(EventEntry, { key: entry.key, entry, execution, command, binding }),
      ),
    ),
  );
}
