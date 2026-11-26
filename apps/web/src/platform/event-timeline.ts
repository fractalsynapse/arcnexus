import { createElement as h } from 'react';
import {
  MessageTimeline,
  type CommandBinding,
  type CommandState,
} from '../../../../packages/ui/src/index.js';
import { EventQuestion } from './event-question.js';
import { EventActivity } from './event-activity.js';
import { EventEntry } from './event-entry.js';
import type { TimelineEntry } from './timeline-groups.js';
import { plainTimelineMessage } from './timeline-message.js';
import { useTimelineTail } from './timeline-tail.js';

interface TimelineProps {
  entries: readonly TimelineEntry[];
  execution?: string;
  command: CommandState;
  binding: CommandBinding;
  active: boolean;
  path?: string;
  sequence?: string;
  messagesOnly?: boolean;
}

/** Keep page scrolling and event identity consistent across both timeline views. */
export function EventTimeline({
  entries,
  execution,
  command,
  binding,
  active,
  path,
  sequence,
  messagesOnly,
}: TimelineProps) {
  const tail = useTimelineTail(path, active, sequence);
  return h(
    'div',
    { role: 'log', 'aria-label': 'Planning events', className: 'arc-plan-timeline', ...tail },
    messagesOnly
      ? h(MessageTimeline, {
          messages: entries.flatMap((entry) =>
            messagePoint(entry, { execution, command, binding }),
          ),
        })
      : entries.map((entry) =>
          h(EventEntry, { key: entry.key, entry, execution, command, binding }),
        ),
  );
}

function messagePoint(
  { key, timestamp, message, question, actor }: TimelineEntry,
  scope: Pick<TimelineProps, 'execution' | 'command' | 'binding'>,
) {
  const content = question
    ? h(EventQuestion, { ...scope, question })
    : plainTimelineMessage(message);
  return content
    ? [{ key, timestamp, metadata: actor && h(EventActivity, { actor }), content }]
    : [];
}
