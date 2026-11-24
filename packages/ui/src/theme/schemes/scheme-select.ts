import { createElement as h } from 'react';
import { SelectField } from '../../controls/select-field.js';
import type { Scheme, Palette } from '../theme.js';
import { SchemeSwatches } from './scheme-swatches.js';

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
