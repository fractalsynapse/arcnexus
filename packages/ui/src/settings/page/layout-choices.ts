import { createElement as h } from 'react';
import { panelLayouts, type ColumnCount } from '../../layouts/panels/presets/index.js';
import { LayoutChoice } from './layout-choice.js';

export function LayoutChoices({
  columns,
  choose,
}: {
  columns: ColumnCount;
  choose: (value: ColumnCount) => void;
}) {
  return h(
    'fieldset',
    { className: 'arc-layout-choices' },
    h('legend', null, 'Desktop layout'),
    h(
      'div',
      null,
      panelLayouts.map((layout) =>
        h(LayoutChoice, {
          key: layout.columns,
          layout,
          selected: layout.columns === columns,
          choose,
        }),
      ),
    ),
  );
}
