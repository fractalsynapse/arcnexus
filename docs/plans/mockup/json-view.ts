import { commitReferences, escape } from './view.ts';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export function responseView(source: string) {
  let value: Json;
  try {
    value = JSON.parse(source) as Json;
  } catch {
    return `<pre class="arc-payload">${escape(source)}</pre>`;
  }
  return `<div class="arc-json" aria-label="Formatted model response">${jsonNode(value)}</div>
    <details><summary>Raw response</summary><pre class="arc-payload">${escape(source)}</pre></details>`;
}

function jsonNode(value: Json, key?: string): string {
  const label = key === undefined ? '' : `<span class="arc-json-key">${escape(key)}</span>: `;
  if (value === null || typeof value !== 'object') {
    const kind = value === null ? 'null' : typeof value;
    const literal = JSON.stringify(value);
    return `<div class="arc-json-line">${label}<span class="arc-json-${kind}">
      ${typeof value === 'string' ? commitReferences(literal) : escape(literal)}</span></div>`;
  }
  const array = Array.isArray(value);
  const entries = Object.entries(value) as [string, Json][];
  const unit = array ? 'item' : 'key';
  const type = array ? 'Array' : 'Object';
  const count = entries.length + ' ' + unit + (entries.length === 1 ? '' : 's');
  const shape = array ? '[ ]' : '{ }';
  return `<details class="arc-json-branch" ${key === undefined ? 'open' : ''}>
    <summary>${label}<span class="arc-json-shape">${shape}</span> <span class="arc-json-meta">
      ${type} · ${count}</span></summary>
    <div class="arc-json-children">
      ${entries.map(([name, child]) => jsonNode(child, array ? name : JSON.stringify(name))).join('')}
    </div></details>`;
}
