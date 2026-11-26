import { createElement as h, Fragment } from 'react';
import { isCollection, isMap, parseDocument, type Document, type ParsedNode } from 'yaml';
import { DialogButton } from '../controls/dialog-button.js';
import { CodeView } from './code-view.js';
import { highlightCode } from './markdown.js';
import { StructuredBranch } from './structured-branch.js';

type Collection = Extract<ParsedNode, { items: unknown[] }>;

/** Browse YAML collections and keep an exact syntax-highlighted source view available. */
export function YamlView({
  content,
  document = parseDocument(content),
}: {
  content: string;
  document?: Document.Parsed;
}) {
  const root = document.contents;
  const source = h(CodeView, { content, language: 'yaml' });
  if (document.errors.length || !isCollection(root) || !root.items.length) return source;
  return h(
    'div',
    { className: 'arc-markdown arc-yaml-view' },
    h(
      'div',
      { className: 'arc-yaml-view-actions' },
      h(DialogButton, { label: 'View source', title: 'YAML source', children: source }),
    ),
    collectionEntries(root, content),
  );
}

function collectionEntries(node: Collection, source: string) {
  return isMap(node)
    ? node.items.map(({ key, value }) =>
        yamlEntry(sourceText(key, source) + ':', value, source, key.range[0]),
      )
    : node.items.map((value, index) => yamlEntry('[' + index + ']', value, source, index));
}

function yamlEntry(key: string, node: ParsedNode | null, source: string, id: number) {
  const label = h('code', { className: 'arc-yaml-key' }, key);
  if (isCollection(node) && node.items.length) {
    const count = node.items.length;
    const type = isMap(node) ? 'Mapping' : 'Sequence';
    return h(StructuredBranch, {
      key: id,
      label: h(Fragment, null, label, h('small', null, type + ' · ' + count)),
      render: () => collectionEntries(node, source),
    });
  }
  const text = sourceText(node, source).trimEnd();
  if (text.includes('\n'))
    return h(StructuredBranch, {
      key: id,
      label: h(Fragment, null, label, h('small', null, 'Multiline value')),
      render: () => h(CodeView, { content: text, language: 'yaml' }),
    });
  return h(
    'div',
    { key: id, className: 'arc-structured-entry' },
    label,
    h('code', { dangerouslySetInnerHTML: { __html: highlightCode(text || 'null', 'yaml') ?? '' } }),
  );
}

function sourceText(node: ParsedNode | null, source: string) {
  return node ? source.slice(node.range[0], node.range[1]) : 'null';
}
