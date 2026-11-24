import { createElement as h, useState, type SubmitEvent } from 'react';
import { Button } from '../../../../packages/ui/src/index.js';

export function ImportProject({ submit }: { submit(remote: string): Promise<void> }) {
  const [remote, setRemote] = useState('');
  const importRepository = (event: SubmitEvent) => {
    event.preventDefault();
    void submit(remote);
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
        onChange: (event) => setRemote(event.currentTarget.value),
      }),
    ),
    h(Button, { type: 'submit' }, 'Add project'),
  );
}
