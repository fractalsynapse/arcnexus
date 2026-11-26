import { createElement as h } from 'react';
import type { ModelRequest } from '../../../foundation/src/model-request.js';
import { Tabs } from '../controls/tabs.js';
import { JsonView } from './json-view.js';

/** Display captured sections in source order and retain the full request text. */
export function ModelRequestView({ request }: { request: ModelRequest }) {
  return h(Tabs, {
    label: 'Model request sections',
    sections: [
      ...inputSections(request.input),
      { title: 'Model options', content: h(JsonView, { value: request.options }) },
      { title: 'Raw input', content: requestText(request.input) },
    ],
  });
}

function inputSections(input: string) {
  const headings = [...input.matchAll(/^## ([^\n]+)\nSource: ([^\n]+)\n/gm)];
  return headings.map((match, index) => ({
    title: match[1]!,
    content: h(
      'div',
      { className: 'arc-model-section' },
      h('small', null, match[2]),
      requestText(input.slice(match.index + match[0].length, headings[index + 1]?.index).trim()),
    ),
  }));
}

function requestText(text: string) {
  return h('pre', { className: 'arc-model-request' }, text);
}
