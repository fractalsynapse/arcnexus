import { createElement as h, Fragment } from 'react';
import { isMap, parseDocument } from 'yaml';
import { capturedDocuments } from './captured-documents.js';
import { CodeView } from './code-view.js';
import { MarkdownView } from './markdown-view.js';

/** Render captured documents and structured values with their shared viewers. */
export function ModelSection({ source, text }: { source: string; text: string }) {
  const documents = capturedDocuments(text);
  return h(
    'div',
    { className: 'arc-model-section' },
    h('small', null, source),
    documents.length ? documentBlocks(text, documents) : formattedSection(text),
  );
}

function documentBlocks(text: string, documents: ReturnType<typeof capturedDocuments>) {
  let previous = 0;
  const blocks = documents.map(({ path, content, start, end }) => {
    const preceding = text.slice(previous, start).trim();
    previous = end;
    return h(
      Fragment,
      { key: start },
      preceding && h(MarkdownView, { content: preceding }),
      h('small', null, path),
      /\.ya?ml$/i.test(path)
        ? h(CodeView, { content, language: 'yaml' })
        : h(MarkdownView, { content }),
    );
  });
  const trailing = text.slice(previous).trim();
  if (trailing) blocks.push(h(Fragment, { key: previous }, h(MarkdownView, { content: trailing })));
  return blocks;
}

function formattedSection(text: string) {
  const yaml = parseDocument(text);
  return !yaml.errors.length && isMap(yaml.contents)
    ? h(CodeView, { content: text, language: 'yaml' })
    : h(MarkdownView, { content: text });
}
