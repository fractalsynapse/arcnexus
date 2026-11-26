import { createElement as h } from 'react';
import { splitMarkdown } from '../../../foundation/src/markdown-document.js';
import { renderMarkdown } from './markdown.js';

/** Show a document body while its metadata is displayed by the owning workspace. */
export function MarkdownView({ content }: { content: string }) {
  return h('article', {
    className: 'arc-markdown arc-md-view',
    dangerouslySetInnerHTML: { __html: renderMarkdown(splitMarkdown(content).body) },
  });
}
