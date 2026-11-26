import { syntaxHighlighting } from '@codemirror/language';
import { classHighlighter } from '@lezer/highlight';
import {
  codeBlockPlugin,
  diffSourcePlugin,
  headingsPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  markdownSourceEditorValue$,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  useCodeBlockEditorContext,
  viewMode$,
  type CodeBlockEditorProps,
} from '@mdxeditor/editor';
import type { Realm } from '@mdxeditor/gurx';
import { createElement as h, type ChangeEvent, type ReactNode } from 'react';

export type MarkdownMode = 'rich-text' | 'source';
export type MarkdownDraft = { mode: MarkdownMode; body: string; switching: boolean };

/** Configure the same visual and syntax-highlighted source capabilities for every editor. */
export function markdownPlugins(mode: MarkdownMode, toolbarContents: () => ReactNode) {
  return [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    tablePlugin(),
    codeBlockPlugin({
      codeBlockEditorDescriptors: [{ priority: 0, match: () => true, Editor: MarkdownCode }],
    }),
    markdownShortcutPlugin(),
    diffSourcePlugin({
      viewMode: mode,
      codeMirrorExtensions: [syntaxHighlighting(classHighlighter)],
    }),
    toolbarPlugin({ toolbarContents }),
  ];
}

function MarkdownCode({ code, language }: CodeBlockEditorProps) {
  const { setCode } = useCodeBlockEditorContext();
  return h('textarea', {
    className: 'arc-mdx-code',
    'aria-label': language ? language + ' code block' : 'Code block',
    value: code,
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => setCode(event.currentTarget.value),
  });
}

export function markdownDraft(body: string): MarkdownDraft {
  return { mode: 'rich-text', body, switching: false };
}

/** Preserve source bytes when initialization or a mode switch normalizes the visual document. */
export function updateMarkdownDraft(entry: MarkdownDraft, body: string, initial: boolean) {
  if (entry.switching || initial) return;
  if (entry.mode === 'source') {
    entry.body = body;
    return;
  }
  const before = entry.body.match(/^(?:[ \t]*\r?\n)*/)?.[0] ?? '';
  const after = entry.body.match(/(?:\r?\n)+$/)?.[0] ?? '';
  entry.body = before + body.replace(/^(?:[ \t]*\r?\n)+|(?:\r?\n)+$/g, '') + after;
}

export function switchMarkdownMode(entry: MarkdownDraft, realm: Realm, next: MarkdownMode) {
  if (entry.mode === next) return;
  entry.switching = true;
  entry.mode = next;
  try {
    realm.pub(viewMode$, next);
    if (next === 'source') realm.pub(markdownSourceEditorValue$, entry.body);
  } finally {
    entry.switching = false;
  }
}
