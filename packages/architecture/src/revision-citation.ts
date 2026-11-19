import type { ProjectSource } from './source.js';

export interface RevisionCitation {
  path: string;
  quote: string;
}

/** Require a meaningful excerpt of a tracked file at the evaluated Git revision. */
export function revisionCitation(value: unknown, source: ProjectSource): RevisionCitation {
  if (!value || typeof value !== 'object' || !('path' in value) || !('quote' in value))
    throw new Error('A citation needs a repository-relative path and exact excerpt');
  const { path, quote } = value;
  if (typeof path !== 'string' || !source.paths.includes(path))
    throw new Error(`Citation path is absent at ${source.revision}: ${String(path)}`);
  if (typeof quote !== 'string' || !quote.trim() || !source.read(path).includes(quote))
    throw new Error(`Citation excerpt does not match ${path} at ${source.revision}`);
  return { path, quote };
}
