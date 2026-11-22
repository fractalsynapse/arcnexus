import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  codeBlockPlugin,
  diffSourcePlugin,
  headingsPlugin,
  linkPlugin,
  listsPlugin,
  markdownProcessingError$,
  markdownShortcutPlugin,
  markdownSourceEditorValue$,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  useCodeBlockEditorContext,
  viewMode$,
} from '@mdxeditor/editor';
import type { CodeBlockEditorProps } from '@mdxeditor/editor';
import { useCellValue, useRealm } from '@mdxeditor/gurx';
import type { Realm } from '@mdxeditor/gurx';
import editorStyle from '@mdxeditor/editor/style.css';
import { createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { splitMarkdown } from './markdown.ts';
import type { Revision } from './model.ts';

type EditMode = 'rich-text' | 'source';

type Draft = {
  revision: Revision;
  mode: EditMode;
  body: string;
  switching: boolean;
};

let draft: Draft | undefined;
let root: Root | undefined;

export function detachMarkdownEditor() {
  root?.unmount();
  root = undefined;
}

export function mountMarkdownEditor(host: HTMLElement | null, revision: Revision | undefined) {
  if (!host || !revision) {
    draft = undefined;
    return;
  }
  const entry = draft?.revision === revision ? draft : openDraft(revision);
  draft = entry;
  installStyle();
  root = createRoot(host);
  root.render(
    createElement(MDXEditor, {
      className: 'arc-mdx',
      overlayContainer: host.closest<HTMLElement>('#arc-preview'),
      contentEditableClassName: 'arc-markdown arc-mdx-visual',
      markdown: entry.body,
      trim: false,
      suppressHtmlProcessing: true,
      toMarkdownOptions: { bullet: '-', emphasis: '*', fences: true },
      onChange: (body, initial) => updateDraft(entry, body, initial),
      plugins: editorPlugins(entry),
    }),
  );
}

function openDraft(revision: Revision): Draft {
  return {
    revision,
    mode: 'rich-text',
    body: splitMarkdown(revision.content).body,
    switching: false,
  };
}

function installStyle() {
  if (document.getElementById('arc-mdx-style')) return;
  const style = document.createElement('style');
  style.id = 'arc-mdx-style';
  style.textContent = editorStyle;
  document.head.prepend(style);
}

export function editedMarkdown(revision: Revision) {
  if (draft?.revision !== revision) return revision.content;
  const { body, frontmatter } = splitMarkdown(revision.content);
  if (body === draft.body) return revision.content;
  const newline = revision.content.includes('\r\n') ? '\r\n' : '\n';
  return frontmatter + draft.body.replace(/\r?\n/g, newline);
}

function updateDraft(entry: Draft, body: string, initial: boolean) {
  // Ignore visual normalization during import or a mode switch until the operator edits.
  if (entry.switching || (initial && entry.mode === 'rich-text')) return;
  if (entry.mode === 'rich-text') {
    const before = entry.body.match(/^(?:[ \t]*\r?\n)*/)?.[0] ?? '';
    const after = entry.body.match(/(?:\r?\n)+$/)?.[0] ?? '';
    entry.body = before + body.replace(/^(?:[ \t]*\r?\n)+|(?:\r?\n)+$/g, '') + after;
  } else {
    entry.body = body;
  }
}

function editorPlugins(entry: Draft) {
  return [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    tablePlugin(),
    codeBlockPlugin({
      codeBlockEditorDescriptors: [{ priority: 0, match: () => true, Editor: CodeBlock }],
    }),
    markdownShortcutPlugin(),
    diffSourcePlugin({ viewMode: entry.mode }),
    toolbarPlugin({ toolbarContents: () => createElement(EditorToolbar, { entry }) }),
  ];
}

function CodeBlock({ code, language }: CodeBlockEditorProps) {
  const { setCode } = useCodeBlockEditorContext();
  return createElement('textarea', {
    className: 'arc-mdx-code',
    'aria-label': language ? language + ' code block' : 'Code block',
    value: code,
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setCode(event.currentTarget.value),
  });
}

function EditorToolbar({ entry }: { entry: Draft }) {
  const realm = useRealm();
  const mode = useCellValue(viewMode$);
  const error = useCellValue(markdownProcessingError$);
  useEffect(() => {
    if (error && mode === 'rich-text') changeMode(entry, realm, 'source');
  }, [entry, realm, error, mode]);
  return createElement(
    'div',
    { className: 'arc-mdx-tools' },
    createElement(
      'div',
      { className: 'arc-mdx-modes', role: 'group', 'aria-label': 'Markdown editing mode' },
      modeButton('Visual', mode === 'rich-text', () => changeMode(entry, realm, 'rich-text')),
      modeButton('Raw', mode === 'source', () => changeMode(entry, realm, 'source')),
    ),
    mode === 'rich-text' &&
      createElement(
        'div',
        { className: 'arc-mdx-format' },
        createElement(UndoRedo),
        createElement(BlockTypeSelect),
        createElement(BoldItalicUnderlineToggles, { options: ['Bold', 'Italic'] }),
        createElement(ListsToggle),
      ),
  );
}

function changeMode(entry: Draft, realm: Realm, next: EditMode) {
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

function modeButton(label: string, selected: boolean, onClick: () => void) {
  return createElement(
    'button',
    {
      type: 'button',
      className: 'arc-button',
      'aria-pressed': selected,
      onClick,
    },
    label,
  );
}
