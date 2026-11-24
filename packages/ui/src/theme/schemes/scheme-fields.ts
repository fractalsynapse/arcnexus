import { createElement as h } from 'react';
import { ColorPicker } from '../color-picker/color-picker.js';
import { colorFields, contrastWarning } from '../theme.js';
import type { Scheme } from '../theme.js';

export function SchemeFields({ draft, update }: { draft: Scheme; update: (next: Scheme) => void }) {
  return h(
    'div',
    { className: 'arc-scheme-fields' },
    h(
      'label',
      null,
      'Scheme name',
      h('input', {
        required: true,
        value: draft.name,
        onChange: ({ currentTarget }) => update({ ...draft, name: currentTarget.value }),
      }),
    ),
    h(
      'div',
      { className: 'arc-color-fields' },
      colorFields.map((field) =>
        h(ColorPicker, {
          key: field,
          field,
          color: draft.colors[field],
          pick: (value) => update({ ...draft, colors: { ...draft.colors, [field]: value } }),
        }),
      ),
    ),
    h('small', { role: 'status' }, contrastWarning(draft.colors)),
  );
}
