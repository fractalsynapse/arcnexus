import { createElement as h } from 'react';
import { renderCodeBlock } from './markdown.js';

/** Display source with the shared read-only Markdown code treatment. */
export function CodeView({ content, language }: { content: string; language: string }) {
  return h('div', {
    className: 'arc-markdown',
    dangerouslySetInnerHTML: { __html: renderCodeBlock(content, language) },
  });
}
