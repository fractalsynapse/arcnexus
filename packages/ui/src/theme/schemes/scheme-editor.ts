import { useState, createElement as h } from 'react';
import type { FormEvent } from 'react';
import type { Theme, Scheme } from '../theme.js';
import { SchemeFields } from './scheme-fields.js';
import { SchemeSave } from './scheme-save.js';
import { SchemeSelect } from './scheme-select.js';

function newScheme(theme: Theme): Scheme {
  return { id: '', name: '', colors: theme.current?.colors ?? theme.defaultColors };
}

export function SchemeEditor({ theme }: { theme: Theme }) {
  const [draft, setDraft] = useState(() => newScheme(theme));
  const [feedback, setFeedback] = useState('');
  const edit = (id: string) => {
    setDraft(theme.schemes.find((scheme) => scheme.id === id) ?? newScheme(theme));
    setFeedback('');
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveScheme(theme, draft, setDraft, setFeedback);
  };
  return h(
    'form',
    { className: 'arc-scheme-editor', onSubmit: save },
    h(SchemeSelect, {
      label: 'Scheme to edit',
      selected: draft.id,
      schemes: theme.schemes,
      defaultName: 'New scheme',
      defaultColors: draft.colors,
      choose: edit,
    }),
    h(SchemeFields, { draft, update: setDraft }),
    h(SchemeSave, { feedback }),
  );
}

function saveScheme(
  theme: Theme,
  draft: Scheme,
  setDraft: (scheme: Scheme) => void,
  feedback: (message: string) => void,
) {
  const name = draft.name.trim();
  if (!name) return feedback('Enter a scheme name.');
  if (
    theme.schemes.some(
      (scheme) => scheme.id !== draft.id && scheme.name.toLowerCase() === name.toLowerCase(),
    )
  )
    return feedback('This scheme name is already in use.');
  const next = { ...draft, id: draft.id || crypto.randomUUID(), name };
  theme.save(next);
  setDraft(next);
  feedback('Saved ' + name + '.');
}
