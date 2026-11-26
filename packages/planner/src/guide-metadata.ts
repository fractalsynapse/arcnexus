import { parse } from 'yaml';
import { z } from 'zod';
import { splitMarkdown } from '../../foundation/src/markdown-document.js';

const metadata = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  topics: z.array(z.string()).optional(),
});

/** Read optional display fields from the exact guide revision. */
export function guideMetadata(content: string) {
  const { metadata: source, body } = splitMarkdown(content);
  const fields = readFields(source);
  return { ...fields, name: fields.name?.trim() || guideHeading(body) };
}

function readFields(source: string) {
  try {
    const document: unknown = parse(source);
    return metadata.safeParse(document).data ?? {};
  } catch {
    return {};
  }
}

/** Use authored headings and derive a label from the exact text of older objective records. */
function guideHeading(body: string) {
  const heading = /^#[ \t]+(.+)$/m.exec(body)?.[1]?.trim();
  if (heading !== 'Human objective') return heading;
  const exact = /^## Exact submission\s*^(`{3,})text[ \t]*\r?\n([\s\S]*?)^\1[ \t]*$/m.exec(
    body,
  )?.[2];
  const submission = exact?.replace(/^Refines [a-z0-9-]+[ \t]*\r?\n/i, '').trim();
  if (!submission) return;
  return new Intl.Segmenter(undefined, { granularity: 'sentence' })
    .segment(submission)
    .containing(0)
    ?.segment.trim();
}
