import { createElement as h, useId, useState } from 'react';
import type { SubmitEvent } from 'react';
import { Button } from '../../../../packages/ui/src/index.js';
import type { Project } from './active-project.js';

interface AddProjectProps {
  projects: readonly Project[];
  onAdd: (project: Project) => void;
}

/** Validate the GitHub repository format without contacting a provider in the preview. */
function repository(input: string) {
  const url = URL.parse(input.trim());
  if (
    url?.origin !== 'https://github.com' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    return;
  const parts = /^\/([\w.-]+)\/([\w.-]+)\/?$/.exec(url.pathname);
  const name = parts?.[2]?.replace(/\.git$/i, '');
  if (name) return { url: 'https://github.com/' + parts?.[1] + '/' + name, name };
}

function useProjectImport({ projects, onAdd }: AddProjectProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const project = repository(input);
    if (!project) return setError('Enter a GitHub repository URL.');
    if (projects.some(({ url }) => url.toLowerCase() === project.url.toLowerCase()))
      return setError('This project is already registered.');
    onAdd(project);
    setInput('');
    setError('');
  };
  return { input, setInput, error, submit };
}

export function AddProject(props: AddProjectProps) {
  const id = useId();
  const { input, setInput, error, submit } = useProjectImport(props);
  return h(
    'form',
    { className: 'arc-platform-stack', onSubmit: submit },
    h(
      'label',
      { htmlFor: id },
      'GitHub repository',
      h('input', {
        id,
        type: 'url',
        required: true,
        value: input,
        placeholder: 'https://github.com/owner/repository',
        onChange: (event) => setInput(event.currentTarget.value),
      }),
    ),
    error && h('p', { role: 'alert' }, error),
    h(
      'div',
      { className: 'arc-platform-inline' },
      h(Button, { type: 'submit', className: 'arc-solid' }, 'Add project'),
      h('small', null, 'Public or private GitHub URL. Reachability checks require the platform.'),
    ),
  );
}
