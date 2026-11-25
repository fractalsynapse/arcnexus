import { diffLines } from 'diff';
import { createElement as h, useState } from 'react';

export interface FileDelta {
  path: string;
  before: string;
  after: string;
}

/** Present a vertical file selector and color-coded, line-level changes. */
export function DiffView({ files }: { files: readonly FileDelta[] }) {
  const [selected, select] = useState('');
  const current = files.find((file) => file.path === selected) ?? files[0];
  if (!current) return h('p', null, 'No changes recorded.');
  return h(
    'div',
    { className: 'arc-diff' },
    h(
      'ul',
      { className: 'arc-diff-files', 'aria-label': 'Changed files' },
      files.map((file) =>
        h(
          'li',
          { key: file.path },
          h(
            'button',
            { type: 'button', 'aria-pressed': file === current, onClick: () => select(file.path) },
            file.path,
          ),
        ),
      ),
    ),
    h(DiffContent, { file: current }),
  );
}

function DiffContent({ file }: { file: FileDelta }) {
  if (file.before === file.after) return h('p', null, 'No changes for this revision.');
  return h(
    'pre',
    { className: 'arc-diff-content', 'aria-label': 'Changes for ' + file.path },
    diffLines(file.before, file.after).flatMap(({ value, added, removed }, index) =>
      value
        .replace(/\n$/, '')
        .split('\n')
        .map((line, row) =>
          h(
            'span',
            {
              key: index + ':' + row,
              'data-change': added ? 'added' : removed ? 'removed' : 'context',
            },
            (added ? '+ ' : removed ? '− ' : '  ') + line + '\n',
          ),
        ),
    ),
  );
}
