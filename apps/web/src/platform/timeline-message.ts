import { createElement as h } from 'react';
import { JsonView } from '../../../../packages/ui/src/index.js';

/** Open structured final responses as a tree while leaving status text inline. */
export function TimelineMessage({ message }: { message: string }) {
  const value = readObject(message);
  return value
    ? h(
        'details',
        { className: 'arc-plan-disclosure' },
        h('summary', null, 'Final model response'),
        h(JsonView, { value }),
      )
    : h('p', { className: 'arc-plan-message' }, message);
}

function readObject(text: string): object | undefined {
  if (!/^[{[]/.test(text.trim())) return;
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === 'object') return value;
  } catch {}
}
