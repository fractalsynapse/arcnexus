import { createElement as h } from 'react';
import {
  Disclosure,
  LocalTime,
  type CommandBinding,
  type CommandState,
} from '../../../../packages/ui/src/index.js';
import { EventQuestion } from './event-question.js';
import { EventActivity } from './event-activity.js';
import { OperationRow } from './operation-row.js';
import { TimelineMessage } from './timeline-message.js';
import type { Operation, TimelineEntry } from './timeline-groups.js';

interface EntryProps {
  entry: TimelineEntry;
  execution?: string;
  command: CommandState;
  binding: CommandBinding;
}

/** Keep the status message and its expandable tool calls together. */
export function EventEntry({ entry, execution, command, binding }: EntryProps) {
  const { timestamp, message, question, operations, actor } = entry;
  return h(
    'article',
    { className: 'arc-plan-event' },
    (timestamp || actor) &&
      h(
        'header',
        { className: 'arc-platform-inline' },
        h(LocalTime, { timestamp }),
        actor && h(EventActivity, { actor }),
      ),
    message && h(TimelineMessage, { message }),
    question && h(EventQuestion, { question, command, binding, execution }),
    !!operations.length && h(OperationGroup, { operations, execution }),
  );
}

function OperationGroup({
  operations,
  execution,
}: {
  operations: Operation[];
  execution?: string;
}) {
  const label = operations.length + (operations.length === 1 ? ' operation' : ' operations');
  return h(
    Disclosure,
    { label },
    h(
      'ul',
      null,
      operations.map((entry) => h(OperationRow, { key: entry.key, entry, execution })),
    ),
  );
}
