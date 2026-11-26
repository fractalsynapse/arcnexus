import { createElement as h, type ReactNode } from 'react';
import { LocalTime } from './local-time.js';

export interface MessagePoint {
  key: string;
  timestamp: string | null;
  metadata?: ReactNode;
  content: ReactNode;
}

/** Display messages and human requests along a chronological rail. */
export function MessageTimeline({ messages }: { messages: readonly MessagePoint[] }) {
  if (!messages.length) return h('p', null, 'No messages recorded yet.');
  return h(
    'ol',
    { className: 'arc-message-timeline' },
    messages.map(({ key, timestamp, metadata, content }) =>
      h(
        'li',
        { key },
        (timestamp || metadata) &&
          h(
            'header',
            { className: 'arc-message-timeline-meta' },
            h(LocalTime, { timestamp }),
            metadata,
          ),
        typeof content === 'string' ? h('p', null, content) : content,
      ),
    ),
  );
}
