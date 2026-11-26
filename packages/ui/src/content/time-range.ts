import { createElement as h } from 'react';
import { LocalTime } from './local-time.js';

/** Keep both timestamps precise and repeat the date only when the local day changes. */
export function TimeRange({ start, end }: { start?: string | null; end?: string | null }) {
  if (!start && !end) return null;
  const first = datePrefix(start);
  const last = datePrefix(end);
  return h(
    'span',
    { className: 'arc-time-range' },
    h(LocalTime, { timestamp: start, prefix: first }),
    start && end ? ' ' : null,
    end &&
      h(
        'span',
        null,
        start ? '- ' : null,
        h(LocalTime, { timestamp: end, prefix: first === last ? undefined : last }),
      ),
  );
}

function datePrefix(timestamp?: string | null) {
  return timestamp ? new Date(timestamp).toLocaleDateString() + ': ' : undefined;
}
