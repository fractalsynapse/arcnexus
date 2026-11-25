import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  markdownProcessingError$,
  viewMode$,
} from '@mdxeditor/editor';
import { useCellValue, useRealm } from '@mdxeditor/gurx';
import editorStyle from '@mdxeditor/editor/style.css';
import { createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { splitMarkdown } from './markdown.ts';
import type { Revision } from './model.ts';

import {
  markdownDraft,
  markdownPlugins,
  switchMarkdownMode,
  updateMarkdownDraft,
  type MarkdownDraft,
} from '../../../packages/ui/src/content/markdown-editing.js';

let draft: (MarkdownDraft & { revision: Revision }) | undefined;
let unmountFile: (() => void) | undefined;

export function detachMarkdownEditor() {
  unmountFile?.();
  unmountFile = undefined;
}

export function mountMarkdownEditor(host: HTMLElement | null, revision: Revision | undefined) {
  if (!host || !revision) {
    draft = undefined;
    return;
  }
  const entry =
    draft?.revision === revision
      ? draft
      : { revision, ...markdownDraft(splitMarkdown(revision.content).body) };
  draft = entry;
  unmountFile = mountMarkdownBody(host, entry);
}

export function mountMarkdownField(
  host: HTMLElement,
  body: string,
  onEdit: (body: string) => void,
) {
  return mountMarkdownBody(host, markdownDraft(body), onEdit, host);
}

function mountMarkdownBody(
  host: HTMLElement,
  entry: MarkdownDraft,
  onEdit?: (body: string) => void,
  overlay = host.closest<HTMLElement>('.arc-surface') ?? host,
) {
  installStyle();
  const root = createRoot(host);
  root.render(
    createElement(MDXEditor, {
      className: 'arc-mdx',
      overlayContainer: overlay,
      contentEditableClassName: 'arc-markdown arc-mdx-visual',
      markdown: entry.body,
      trim: false,
      suppressHtmlProcessing: true,
      toMarkdownOptions: { bullet: '-', emphasis: '*', fences: true },
      onChange: (body, initial) => {
        const previous = entry.body;
        updateMarkdownDraft(entry, body, initial);
        if (entry.body !== previous) onEdit?.(entry.body);
      },
      plugins: markdownPlugins(entry.mode, () => createElement(EditorToolbar, { entry })),
    }),
  );
  return () => root.unmount();
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

function EditorToolbar({ entry }: { entry: MarkdownDraft }) {
  const realm = useRealm();
  const mode = useCellValue(viewMode$);
  const error = useCellValue(markdownProcessingError$);
  useEffect(() => {
    if (error && mode === 'rich-text') switchMarkdownMode(entry, realm, 'source');
  }, [entry, realm, error, mode]);
  return createElement(
    'div',
    { className: 'arc-mdx-tools' },
    createElement(
      'div',
      { className: 'arc-mdx-modes', role: 'group', 'aria-label': 'Markdown editing mode' },
      modeButton('Visual', mode === 'rich-text', () => switchMarkdownMode(entry, realm, 'rich-text')),
      modeButton('Raw', mode === 'source', () => switchMarkdownMode(entry, realm, 'source')),
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
