import { createElement as h } from 'react';
import { TokenHistory, type TokenSample } from '../../../../packages/ui/src/index.js';
import { useResource } from './resource.js';

/** Request retained samples only while the operator has the history open. */
export function PlanTokenHistory({ path, refresh }: { path: string; refresh?: string }) {
  const history = useResource<{ samples: TokenSample[] }>(path, refresh);
  if (history.error) return h('p', { role: 'alert' }, history.error);
  if (!history.value) return h('p', { role: 'status' }, 'Loading token history…');
  return h(TokenHistory, { samples: history.value.samples });
}
