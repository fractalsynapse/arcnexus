import { createElement as h } from 'react';
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
      { className: 'arc-layout-diagram', 'aria-hidden': true },
      layout.regions.map((region) => h('i', { key: region })),
    ),
    layout.label,
  );
}
