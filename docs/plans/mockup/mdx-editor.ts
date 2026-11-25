import editorStyle from '@mdxeditor/editor/style.css';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MarkdownEditor } from '../../../packages/ui/src/content/markdown-editor.js';
import { markdownDraft, type MarkdownDraft } from '../../../packages/ui/src/content/markdown-editing.js';
import { splitMarkdown } from './markdown.ts';
import type { Revision } from './model.ts';

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

export function mountMarkdownField(host: HTMLElement, body: string, onEdit: (body: string) => void) {
  return mountMarkdownBody(host, markdownDraft(body), onEdit, host);
}

function mountMarkdownBody(
  host: HTMLElement,
  draft: MarkdownDraft,
  edit?: (body: string) => void,
  overlayContainer = host.closest<HTMLElement>('.arc-surface') ?? host,
) {
  installStyle();
  const root = createRoot(host);
  root.render(createElement(MarkdownEditor, { body: draft.body, draft, edit, overlayContainer }));
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
