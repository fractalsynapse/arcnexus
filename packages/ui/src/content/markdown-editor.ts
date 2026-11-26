import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ListsToggle,
  markdownProcessingError$,
  MDXEditor,
  UndoRedo,
  viewMode$,
} from '@mdxeditor/editor';
import { useCellValue, useRealm } from '@mdxeditor/gurx';
import { createElement as h, useEffect, useState } from 'react';
import { Button } from '../controls/button.js';
import {
  markdownDraft,
  markdownPlugins,
  switchMarkdownMode,
  updateMarkdownDraft,
  type MarkdownDraft,
} from './markdown-editing.js';

interface EditorProps {
  body: string;
  edit?: (body: string) => void;
  draft?: MarkdownDraft;
  overlayContainer?: HTMLElement;
}

/** Edit prose visually or in syntax-highlighted Markdown source. */
export function MarkdownEditor(props: EditorProps) {
  const [host, mount] = useState<HTMLDivElement | null>(null);
  return h(
    'div',
    { className: 'arc-md-edit', ref: mount },
    host &&
      h(EditorSurface, {
        ...props,
        overlayContainer: props.overlayContainer ?? host,
      }),
  );
}

function EditorSurface({ body, edit, draft, overlayContainer }: EditorProps) {
  const [entry] = useState(() => draft ?? markdownDraft(body));
  const [markdown] = useState(entry.body);
  return h(MDXEditor, {
    className: 'arc-mdx',
    contentEditableClassName: 'arc-markdown arc-mdx-visual',
    overlayContainer,
    markdown,
    trim: false,
    suppressHtmlProcessing: true,
    toMarkdownOptions: { bullet: '-', emphasis: '*', fences: true },
    onChange: (value, initial) => {
      const previous = entry.body;
      updateMarkdownDraft(entry, value, initial);
      if (previous !== entry.body) edit?.(entry.body);
    },
    plugins: markdownPlugins(entry.mode, () => h(EditorToolbar, { entry })),
  });
}

function EditorToolbar({ entry }: { entry: MarkdownDraft }) {
  const mode = useCellValue(viewMode$);
  const error = useCellValue(markdownProcessingError$);
  const realm = useRealm();
  useEffect(() => {
    if (error && mode !== 'source') switchMarkdownMode(entry, realm, 'source');
  }, [entry, error, mode, realm]);
  return h(
    'div',
    { className: 'arc-mdx-tools' },
    h(EditorModes, { entry, source: mode === 'source', unavailable: !!error }),
    mode === 'rich-text' && h(VisualTools),
    error && h('small', { role: 'status' }, 'This document can be edited in Raw mode.'),
  );
}

function VisualTools() {
  return h(
    'div',
    { className: 'arc-mdx-format' },
    h(UndoRedo),
    h(BlockTypeSelect),
    h(BoldItalicUnderlineToggles, { options: ['Bold', 'Italic'] }),
    h(ListsToggle),
  );
}

interface ModeProps {
  entry: MarkdownDraft;
  source: boolean;
  unavailable: boolean;
}

function EditorModes({ entry, source, unavailable }: ModeProps) {
  const realm = useRealm();
  return h(
    'div',
    { className: 'arc-mdx-modes', role: 'group', 'aria-label': 'Markdown editing mode' },
    h(
      Button,
      {
        disabled: unavailable,
        'aria-pressed': !source,
        onClick: () => switchMarkdownMode(entry, realm, 'rich-text'),
      },
      'Visual',
    ),
    h(
      Button,
      {
        'aria-pressed': source,
        onClick: () => switchMarkdownMode(entry, realm, 'source'),
      },
      'Raw',
    ),
  );
}
