import { createElement as h, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from './controls.js';
import { SelectField } from './fields.js';
import { ColorPicker, Swatch } from './color-picker.js';
import { colorFields, contrastWarning, type Palette, type Scheme, type Theme } from './theme.js';

interface SelectProps {
  label: string;
  selected: string;
  schemes: readonly Scheme[];
  defaultName: string;
  defaultColors: Palette;
  choose: (id: string) => void;
}

/** Present a named scheme and its three swatches using a shared selector. */
export function SchemeSelect(props: SelectProps) {
  const displayed = props.schemes.find((scheme) => scheme.id === props.selected);
  const options = [
    { value: '', label: props.defaultName },
    ...props.schemes.map(({ id, name }) => ({ value: id, label: name })),
  ];
  return h(SelectField<string>, {
    label: props.label,
    value: displayed?.id ?? '',
    options,
    onChange: props.choose,
    prefix: h(SchemeSwatches, { colors: displayed?.colors ?? props.defaultColors }),
  });
}

function SchemeSwatches({ colors }: { colors: Palette }) {
  return h(
    'span',
    { className: 'arc-scheme-swatches', 'aria-hidden': true },
    colorFields.map((field) => h(Swatch, { key: field, color: colors[field] })),
  );
}

function newScheme(theme: Theme): Scheme {
  return { id: '', name: '', colors: theme.current?.colors ?? theme.defaultColors };
}

/** Edit the reusable scheme library and choose the background for the whole app. */
export function ColorSchemes({ theme }: { theme: Theme }) {
  return h(
    'div',
    { className: 'arc-schemes' },
    h(SchemeSelect, {
      label: 'Site background and default scheme',
      selected: theme.selected,
      schemes: theme.schemes,
      defaultName: 'ArcNexus default',
      defaultColors: theme.defaultColors,
      choose: theme.select,
    }),
    h(SchemeEditor, { theme }),
  );
}

function SchemeEditor({ theme }: { theme: Theme }) {
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

function SchemeSave({ feedback }: { feedback: string }) {
  return h(
    'div',
    { className: 'arc-form-actions' },
    h('span', { role: 'status' }, feedback),
    h(Button, { type: 'submit', className: 'arc-solid' }, 'Save scheme'),
  );
}

function SchemeFields({ draft, update }: { draft: Scheme; update: (next: Scheme) => void }) {
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
