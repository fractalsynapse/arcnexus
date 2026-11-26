import { createElement as h } from 'react';
import { Disclosure, JsonView } from '../../../../packages/ui/src/index.js';

/** Open structured final responses as a tree while leaving status text inline. */
export function TimelineMessage({ message }: { message: string }) {
  const value = readObject(message);
  return value
    ? h(Disclosure, { label: 'Final model response' }, h(JsonView, { value }))
    : h('p', { className: 'arc-plan-message' }, messageText(message));
}

export function plainTimelineMessage(message: string | undefined) {
  return message && !readObject(message) ? messageText(message) : undefined;
}

function messageText(message: string) {
  return message === 'Planner mapped the captured project'
    ? 'Planning assessment ready. The Planner compared the project’s objectives and goals.'
    : message;
}

function readObject(text: string): object | undefined {
  if (!/^[{[]/.test(text.trim())) return;
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === 'object') return value;
  } catch {}
}
