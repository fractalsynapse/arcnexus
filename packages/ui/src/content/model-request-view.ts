import { createElement as h } from 'react';
import type { ModelRequest } from '../../../foundation/src/model-request.js';
import { Tabs } from '../controls/tabs.js';
import { JsonView } from './json-view.js';
import { capturedDocuments } from './captured-documents.js';
import { ModelSection } from './model-section.js';

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
  const documents = capturedDocuments(input);
  const headings = [...input.matchAll(/^## ([^\n]+)\nSource: ([^\n]+)\n/gm)].filter(
    ({ index }) => !documents.some(({ start, end }) => index > start && index < end),
  );
  return headings.map((match, index) => ({
    title: match[1]!,
    content: h(ModelSection, {
      source: match[2]!,
      text: input.slice(match.index + match[0].length, headings[index + 1]?.index).trim(),
    }),
  }));
}

function requestText(text: string) {
  return h('pre', { className: 'arc-model-request' }, text);
}
