import { textChanges } from './line-changes.js';
import type { DiffLine } from './line-changes.js';
import { createElement as h, useState } from 'react';
import { Button } from '../controls/button.js';
import type { DiffSelection } from './diff-selection.js';

export interface FileDelta {
  path: string;
  before: string;
  after: string;
}

/** Show the same color-coded diff with a file selector only for a collection. */
export function DiffView({ file, files }: DiffSelection<FileDelta>) {
  return file ? h(DiffContent, { file }) : h(FileComparison, { files });
}

function FileComparison({ files }: { files: readonly FileDelta[] }) {
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
            Button,
            {
              variant: 'plain',
              'aria-pressed': file === current,
              onClick: () => select(file.path),
            },
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
  const lines = textChanges(file.before, file.after);
  return h(
    'pre',
    {
      className: 'arc-diff-content arc-diff-lines arc-numbered-diff',
      'aria-label': 'Changes for ' + file.path,
    },
    lines.map(renderLine),
  );
}

function renderLine([kind, text, before, after]: DiffLine, index: number) {
  const props = { key: index, 'data-change': kind };
  if (kind === 'hunk') return h('span', props, text);
  return h(
    'span',
    { ...props, className: 'arc-diff-row' },
    lineNumber(before),
    lineNumber(after),
    h('span', { className: 'arc-diff-code' }, text + '\n'),
  );
}

function lineNumber(value?: number) {
  return h('span', { className: 'arc-diff-number', 'aria-hidden': true }, value);
}
