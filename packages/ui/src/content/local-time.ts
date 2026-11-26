import { createElement as h } from 'react';

/** Render an observed timestamp in the reader's locale and retain its source value. */
export function LocalTime({
  timestamp,
  date,
  prefix = '',
}: {
  timestamp?: string | null;
  date?: boolean;
  prefix?: string;
}) {
  if (!timestamp) return null;
  const point = new Date(timestamp);
  return h(
    'time',
    { dateTime: timestamp },
    prefix,
    date ? point.toLocaleString() : point.toLocaleTimeString(),
  );
}
