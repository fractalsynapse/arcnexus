import { createElement as h } from 'react';
import {
  MessageTimeline,
  type CommandBinding,
  type CommandState,
} from '../../../../packages/ui/src/index.js';
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
      ? h(MessageTimeline, { messages: entries.flatMap(messagePoint) })
      : entries.map((entry) =>
          h(EventEntry, { key: entry.key, entry, execution, command, binding }),
        ),
  );
}

function messagePoint({ key, timestamp, message, question }: TimelineEntry) {
  const text = plainTimelineMessage(message) ?? question?.question;
  return text ? [{ key, timestamp, text }] : [];
}
