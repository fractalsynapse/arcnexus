import { createElement as h } from 'react';

export interface MessagePoint {
  key: string;
  timestamp: string | null;
  text: string;
}

/** Display plain messages along a chronological rail without tool or debug details. */
export function MessageTimeline({ messages }: { messages: readonly MessagePoint[] }) {
  if (!messages.length) return h('p', null, 'No messages recorded yet.');
  return h(
    'ol',
    { className: 'arc-message-timeline' },
    messages.map(({ key, timestamp, text }) =>
      h(
        'li',
        { key },
        timestamp && h('time', { dateTime: timestamp }, new Date(timestamp).toLocaleTimeString()),
        h('p', null, text),
      ),
    ),
  );
}
