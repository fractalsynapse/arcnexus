import { createElement as h, type ReactElement } from 'react';
import { splitMarkdown } from '../../../../packages/foundation/src/markdown-document.js';
import { MarkdownEditor, MarkdownView } from '../../../../packages/ui/src/index.js';
import { usePlanFile } from './plan-file-scope.js';

/** Share the standard Markdown renderer and editor with other file workspaces. */
export function FileContent(): ReactElement | null {
  const { detail, project, editing, body, write } = usePlanFile();
  if (!project) return null;
  if (detail.error) return h('p', { role: 'alert' }, detail.error);
  const value = detail.value;
  if (!value) return h('p', { role: 'status' }, 'Loading file content…');
  const content = value.content;
  if (!editing) return h(MarkdownView, { content });
  return h(MarkdownEditor, { body: body ?? splitMarkdown(content).body, edit: write });
}
