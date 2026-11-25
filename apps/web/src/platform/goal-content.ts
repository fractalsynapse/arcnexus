import { parseDocument } from 'yaml';
import { splitMarkdown } from '../../../../packages/foundation/src/markdown-document.js';
import type { Guide } from './guide.js';

export type GuideFields = Partial<Pick<Guide, 'name' | 'priority' | 'topics'>>;

/** Keep original frontmatter and newlines until the operator changes a field. */
export function draftContent(source: string, body: string | undefined, fields: GuideFields) {
  const changes = Object.entries(fields);
  if (body === undefined && !changes.length) return source;
  const original = splitMarkdown(source);
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const prose = (body ?? original.body).replace(/\r?\n/g, newline);
  if (!changes.length) return original.frontmatter + prose;
  const document = parseDocument(original.metadata);
  for (const [key, value] of changes) document.set(key, value);
  return ('---\n' + document.toString() + '---\n').replace(/\n/g, newline) + prose;
}
