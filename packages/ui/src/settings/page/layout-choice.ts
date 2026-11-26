import { createElement as h } from 'react';
import type { CSSProperties } from 'react';
import { panelRegionsFor } from '../../layouts/panels/presets/index.js';
import type { ColumnCount, PanelLayoutDefinition } from '../../layouts/panels/presets/index.js';

interface ChoiceProps {
  layout: PanelLayoutDefinition;
  selected: boolean;
  choose: (value: ColumnCount) => void;
}

export function LayoutChoice({ layout, selected, choose }: ChoiceProps) {
  return h(
    'label',
    null,
    h('input', {
      type: 'radio',
      name: 'desktop-layout',
      value: layout.columns,
      checked: selected,
      onChange: () => choose(layout.columns),
    }),
    h(
      'span',
      {
        className: 'arc-layout-diagram',
        style: { '--arc-preview-columns': layout.columns } as CSSProperties,
        'aria-hidden': true,
      },
      panelRegionsFor(layout).map(({ id }) =>
        h('i', { key: id, 'data-band': typeof id === 'string' ? '' : undefined }),
      ),
    ),
    layout.label,
  );
}
