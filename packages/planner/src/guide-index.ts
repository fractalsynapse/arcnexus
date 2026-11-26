import { parse } from 'yaml';
import type { Capture } from '../../architecture/src/index.js';
import { splitMarkdown } from '../../foundation/src/markdown-document.js';
import { recordID, type GuideKind } from './guide-data.js';

type GuideCapture = Pick<Capture, 'project' | 'source'>;
type GuideRecord = { id: string; path: string; category?: string; content: string };

/** Use the project's configured knowledge root for either guide collection. */
export function guideDirectory(capture: GuideCapture, kind: GuideKind) {
  return `${capture.project.knowledgeRoot ?? '.arc'}/${kind}`;
}

/** Read the exact captured identities with optional checked candidate edits overlaid. */
export function guideIndex(
  capture: GuideCapture,
  kind: GuideKind,
  changes?: ReadonlyMap<string, string | null>,
) {
  const prefix = guideDirectory(capture, kind) + '/';
  const paths = new Set([...capture.source.paths, ...(changes?.keys() ?? [])]);
  const entries = new Map<string, GuideRecord>();
  for (const path of paths) {
    if (!path.startsWith(prefix) || !path.endsWith('.md')) continue;
    const content = changes?.has(path) ? changes.get(path)! : capture.source.read(path);
    if (content === null) continue;
    const entry = guideRecord(capture, kind, path, content);
    if (entries.has(entry.id))
      throw new Error(`Duplicate ${kind.slice(0, -1)} record ID: ${entry.id}`);
    entries.set(entry.id, entry);
  }
  return entries;
}

/** Resolve an ID from metadata, using the filename for older flat captures. */
export function guideRecord(capture: GuideCapture, kind: GuideKind, path: string, content: string) {
  const prefix = guideDirectory(capture, kind) + '/';
  if (!path.startsWith(prefix) || !path.endsWith('.md'))
    throw new Error(`Invalid ${kind} path: ${path}`);
  const parts = path.slice(prefix.length, -3).split('/');
  if (parts.some((part) => !recordID.test(part))) throw new Error(`Invalid ${kind} path: ${path}`);
  const category = parts.slice(0, -1).join('/') || undefined;
  const fields = parse(splitMarkdown(content).metadata) as { id?: unknown } | null;
  const id = fields?.id === undefined && !category ? parts[0] : fields?.id;
  if (typeof id !== 'string' || !recordID.test(id))
    throw new Error(`Invalid or missing ${kind} record ID: ${path}`);
  return { id, path, category, content } satisfies GuideRecord;
}

/** Recognize repository-relative categories made of named subdirectories. */
export function guideCategory(category: unknown): category is string {
  return typeof category === 'string' && category.split('/').every((part) => recordID.test(part));
}

/** Preserve the original Markdown and insert a stable ID when a new record needs one. */
export function withGuideID(content: string, id: string) {
  const { frontmatter, metadata, body } = splitMarkdown(content);
  const fields = parse(metadata) as { id?: unknown } | null;
  if (fields?.id === id) return content;
  if (fields?.id !== undefined) throw new Error(`A guide edit must preserve its record ID: ${id}`);
  const field = `id: ${JSON.stringify(id)}`;
  if (!frontmatter) return `---\n${field}\n---\n\n${body}`;
  return frontmatter.replace(/\r?\n/, (newline) => `${newline}${field}${newline}`) + body;
}
