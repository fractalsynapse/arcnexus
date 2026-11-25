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
  const { metadata: source } = splitMarkdown(content);
  try {
    const document: unknown = parse(source);
    return metadata.safeParse(document).data ?? {};
  } catch {
    return {};
  }
}
