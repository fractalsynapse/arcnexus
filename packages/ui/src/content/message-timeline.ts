import { createElement as h, type ReactNode } from 'react';
import { LocalTime } from './local-time.js';

export interface MessagePoint {
  key: string;
  timestamp: string | null;
  content: ReactNode;
}

/** Display messages and human requests along a chronological rail. */
export function MessageTimeline({ messages }: { messages: readonly MessagePoint[] }) {
  if (!messages.length) return h('p', null, 'No messages recorded yet.');
  return h(
    'ol',
    { className: 'arc-message-timeline' },
    messages.map(({ key, timestamp, content }) =>
      h(
        'li',
        { key },
        h(LocalTime, { timestamp }),
        typeof content === 'string' ? h('p', null, content) : content,
      ),
    ),
  );
}
