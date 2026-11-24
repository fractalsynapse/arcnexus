import { createElement as h } from 'react';
import { Button } from '../../controls/button.js';

export function SchemeSave({ feedback }: { feedback: string }) {
  return h(
    'div',
    { className: 'arc-form-actions' },
    h('span', { role: 'status' }, feedback),
    h(Button, { type: 'submit', className: 'arc-solid' }, 'Save scheme'),
  );
}
