import { createElement as h, useState, type SubmitEvent } from 'react';
import { Button } from '../../../../packages/ui/src/index.js';

export function ImportProject({ submit }: { submit(remote: string): Promise<boolean> }) {
  const [remote, setRemote] = useState('');
  const importRepository = (event: SubmitEvent) => {
    event.preventDefault();
    void submit(remote).then((added) => {
      if (added) setRemote((current) => (current === remote ? '' : current));
    });
  };
  return h(
    'form',
    { className: 'arc-platform-stack', onSubmit: importRepository },
    h(
      'label',
      null,
      'GitHub repository',
      h('input', {
        required: true,
        value: remote,
        type: 'url',
        placeholder: 'https://github.com/owner/repository',
        onChange: (event) => setRemote(event.currentTarget.value),
      }),
    ),
    h(
      'div',
      { className: 'arc-platform-inline' },
      h(Button, { type: 'submit', className: 'arc-solid' }, 'Add project'),
    ),
  );
}
