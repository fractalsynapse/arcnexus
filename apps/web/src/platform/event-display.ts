import { createElement as h } from 'react';
import { Button, Tabs, type CommandBinding } from '../../../../packages/ui/src/index.js';
import { EventTimeline } from './event-timeline.js';
import { usePlanResource } from './plan-resource.js';
import { groupTimeline } from './timeline-groups.js';
import { useTimeline } from './use-timeline.js';

/** Follow the selected Plan and display only its ordered, retained observations. */
export function EventDisplay({ binding }: { binding: CommandBinding }) {
  const { project, history, events, execution, command, active, recorded } = usePlanResource();
  const timeline = useTimeline(events && events + '/events');
  if (!project) return h('p', null, 'Select a project to see planning events.');
  if (history.error && !events) return h('p', { role: 'alert' }, history.error);
  if (history.value && !execution) return h('p', null, 'No recorded planning execution.');
  const view = {
    entries: groupTimeline(timeline.frames, execution, recorded?.attempt),
    execution,
    command,
    binding,
    active,
    path: events,
    sequence: timeline.frames.at(-1)?.sequence,
  };
  return h(
    'div',
    { className: 'arc-platform-stack' },
    timeline.error && h(StreamNotice, { message: timeline.error, reconnect: timeline.reconnect }),
    h(Tabs, {
      label: 'Event log',
      sections: [
        { title: 'Messages', content: h(EventTimeline, { ...view, messagesOnly: true }) },
        { title: 'Full log', content: h(EventTimeline, view) },
      ],
    }),
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
