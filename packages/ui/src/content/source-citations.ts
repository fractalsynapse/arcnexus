import { createElement as h } from 'react';

type Citation = { path: string; quote: string; revision?: string };

/** Keep the exact source excerpt and its reference readable in reviews and reports. */
export function SourceCitations({ sources }: { sources: readonly Citation[] }) {
  if (!sources.length) return h('p', null, 'No sources cited.');
  return h(
    'ul',
    { className: 'arc-report-list' },
    sources.map(({ path, quote, revision }) =>
      h(
        'li',
        { key: JSON.stringify([path, quote, revision]), className: 'arc-report-source' },
        h('code', null, path),
        revision && h('small', null, revision),
        h('blockquote', { className: 'arc-report-text' }, quote),
      ),
    ),
  );
}
