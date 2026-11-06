import { createHash } from 'node:crypto';
import { git } from './process.js';
import type { PublicationDocument } from '../coordination-store/delivery-types.js';

export type { PublicationDocument as RepositoryDocument } from '../coordination-store/delivery-types.js';

/** Prepares readable collaboration content from committed templates before provider effects begin. */
export class RepositoryDocuments {
  /** Binds template lookup to host-selected source and revision, never a worker path. */
  constructor(
    private readonly source: string,
    private readonly revision: string,
  ) {}

  /** Requires agent-authored issues to include every section of the same captured template. */
  validateIssue(body: unknown): void {
    if (typeof body !== 'string' || !body.trim())
      throw new Error('Issue body must be readable Markdown');
    const template = this.template('issue');
    if (!template) return;
    const required = [...template.content.matchAll(/^## ([^\n]+)$/gm)].map((match) =>
      match[1]!.trim(),
    );
    const present = new Set([...body.matchAll(/^## ([^\n]+)$/gm)].map((match) => match[1]!.trim()));
    const missing = required.filter((heading) => !present.has(heading));
    if (missing.length)
      throw new Error('Issue body requires repository template sections: ' + missing.join(', '));
  }

  /** Fills Markdown sections while retaining the exact template identity used for publication. */
  prepare(
    kind: 'issue' | 'pull-request',
    title: string,
    sections: Record<string, string>,
  ): PublicationDocument {
    const template = this.template(kind);
    const headings = template
      ? [...template.content.matchAll(/^## ([^\n]+)$/gm)].map((match) => match[1]!.trim())
      : Object.keys(sections);
    if (!headings.length)
      throw new Error('Repository template requires Markdown level-two sections');
    const body = headings
      .map((heading) => {
        const content = sections[heading];
        if (content === undefined)
          throw new Error(`Repository template section requires content: ${heading}`);
        return `## ${heading}\n\n${content}`;
      })
      .join('\n\n');
    return {
      title: this.title(title),
      body,
      ...(template ? { template: template.identity } : {}),
    };
  }

  /** Rejects ambiguous or unsupported templates rather than publishing an invented interpretation. */
  private template(kind: 'issue' | 'pull-request') {
    const paths = git(this.source, 'ls-tree', '-r', '--name-only', this.revision).split('\n');
    const candidates = paths.filter((path) =>
      kind === 'issue'
        ? /^\.github\/(ISSUE_TEMPLATE(?:\.md|\/[^/]+\.(?:md|ya?ml)))$/i.test(path) &&
          !path.endsWith('/config.yml')
        : /^(?:\.github\/|docs\/)?pull_request_template\.md$/i.test(path),
    );
    if (candidates.length > 1)
      throw new Error('Multiple repository templates require explicit selection');
    const path = candidates[0];
    if (!path) return undefined;
    if (!path.endsWith('.md'))
      throw new Error('GitHub issue forms require supported template selection');
    const content = git(this.source, 'show', `${this.revision}:${path}`);
    return {
      content: content.replace(/^---\n[\s\S]*?\n---\n/, ''),
      identity: {
        path,
        revision: this.revision,
        sha256: createHash('sha256').update(content).digest('hex'),
      },
    };
  }

  /** Keeps titles readable without leaking serialized runtime payloads or arbitrary line breaks. */
  private title(value: string): string {
    const title = value.replace(/\s+/g, ' ').trim();
    if (!title) throw new Error('Collaboration document requires a descriptive title');
    return title.length <= 120 ? title : title.slice(0, 117).trimEnd() + '…';
  }
}

/** Requires readable prepared publication content in both real and simulated providers. */
export function publicationContent(input: Record<string, unknown>): {
  title: string;
  body: string;
} {
  const { title, body } = input;
  if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim())
    throw new Error('PR requires a prepared repository-format title and body');
  return { title, body };
}
