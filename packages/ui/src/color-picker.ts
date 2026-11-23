import { createElement as h, useId, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, RefObject } from 'react';
import { Icon } from './icons.js';
import type { colorFields } from './theme.js';

const families = {
  Neutral: ['#090a0c', '#22252b', '#383d45', '#66707d', '#aeb8c4', '#e2e7ee', '#ffffff'],
  Red: ['#230b12', '#3d101b', '#651b27', '#ae3748', '#e66f7f', '#ffccd1', '#fff0f1'],
  Orange: ['#271308', '#46200d', '#713411', '#bd5a24', '#f08c55', '#ffd2af', '#fff2e8'],
  Amber: ['#211707', '#3b290d', '#5b4011', '#9b6c17', '#e3ae3e', '#ffe5a0', '#fff7db'],
  Olive: ['#181b09', '#2c320e', '#465017', '#67792a', '#a6b95a', '#e1ebae', '#f5f8e7'],
  Green: ['#0c1c13', '#122e20', '#1b4a30', '#32764b', '#6cb987', '#c1eccd', '#edf9ee'],
  Teal: ['#091c1b', '#102e2d', '#174845', '#26776f', '#5fb6ad', '#b5e9e1', '#e8faf6'],
  Cyan: ['#091b22', '#102d3b', '#18465b', '#257390', '#5cb5ce', '#bdebf4', '#ecfaff'],
  Blue: ['#0b1529', '#132341', '#1d365f', '#305b99', '#6595e0', '#bfd7fc', '#edf4ff'],
  Indigo: ['#14132a', '#232044', '#363067', '#534798', '#8c80db', '#d6ceff', '#f2efff'],
  Violet: ['#1d1028', '#321b44', '#4d2a64', '#7c4899', '#ae78ce', '#ebcdf7', '#f9effd'],
  Pink: ['#240f20', '#3e1835', '#60274f', '#9b437d', '#d576ac', '#f6cbe5', '#fff0f8'],
};

const shades = Object.values(families).flat();
type ColorField = (typeof colorFields)[number];
const titles = { background: 'Background color', text: 'Text color', accent: 'Accent color' };

interface PickerProps {
  field: ColorField;
  color: string;
  pick: (color: string) => void;
}

/** Render any palette color with the common border and swatch shape. */
export function Swatch({ color }: { color: string }) {
  return h('span', {
    className: 'arc-swatch',
    style: { '--swatch': color } as CSSProperties,
    'aria-hidden': true,
  });
}

/** Provide preset and custom choices in a single keyboard-accessible popover. */
export function ColorPicker({ field, color, pick }: PickerProps) {
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choose = (value: string) => {
    pick(value);
    popover.current?.hidePopover();
    trigger.current?.focus({ preventScroll: true });
  };
  return h(
    'div',
    null,
    h(ColorTrigger, { id, title: titles[field], color, control: trigger }),
    h(
      'div',
      {
        id,
        popover: 'auto',
        className: 'arc-color-picker',
        role: 'dialog',
        'aria-labelledby': id + '-title',
        ref: popover,
      },
      h(PickerHeader, { id, title: titles[field], field }),
      h(ShadeScale),
      h(ShadeRows, { field, color, pick: choose }),
      h(CustomColor, { key: color, color, pick: choose }),
    ),
  );
}

function ColorTrigger({
  id,
  title,
  color,
  control,
}: {
  id: string;
  title: string;
  color: string;
  control: RefObject<HTMLButtonElement | null>;
}) {
  return h(
    'button',
    {
      type: 'button',
      className: 'arc-button arc-color-trigger',
      popoverTarget: id,
      ref: control,
      'aria-label': title,
      'aria-haspopup': 'dialog',
    },
    h(Swatch, { color }),
    h('span', null, title, h('code', null, color)),
    h(Icon, { name: 'down' }),
  );
}

function PickerHeader({ id, title, field }: { id: string; title: string; field: ColorField }) {
  return h(
    'header',
    { className: 'arc-dialog-header' },
    h('h3', { id: id + '-title' }, title),
    h(
      'button',
      {
        type: 'button',
        className: 'arc-icon-button',
        'aria-label': 'Close ' + field + ' picker',
        popoverTarget: id,
        popoverTargetAction: 'hide',
      },
      h(Icon, { name: 'close' }),
    ),
  );
}

function ShadeScale() {
  return h(
    'div',
    { className: 'arc-shade-scale', 'aria-hidden': true },
    h('span', null, 'Dark'),
    h('span', null, 'Light'),
  );
}

/** Keep the swatch grid one Tab stop and allow arrows to move within it. */
function ShadeRows(props: PickerProps) {
  return h(
    'div',
    { className: 'arc-shade-grid', onKeyDown: moveShade },
    Object.entries(families).map(([name, values]) =>
      h(ShadeRow, { ...props, key: name, name, values }),
    ),
  );
}

type ShadeRowProps = PickerProps & { name: string; values: readonly string[] };

function ShadeRow({ field, color, pick, name, values }: ShadeRowProps) {
  const initial = shades.includes(color) ? color : shades[0];
  return h(
    'div',
    { className: 'arc-shade-row' },
    h('small', null, name),
    h(
      'div',
      { className: 'arc-shades' },
      values.map((shade) =>
        h('button', {
          key: shade,
          type: 'button',
          className: 'arc-shade',
          'aria-label': name + ' ' + shade + ' for ' + field,
          'aria-pressed': shade === color,
          tabIndex: shade === initial ? 0 : -1,
          autoFocus: shade === initial,
          style: { '--swatch': shade } as CSSProperties,
          onClick: () => pick(shade),
        }),
      ),
    ),
  );
}

function moveShade(event: KeyboardEvent<HTMLDivElement>) {
  if (!(event.target instanceof HTMLButtonElement)) return;
  const count = families.Neutral.length;
  const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -count, ArrowDown: count }[event.key];
  if (!move) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
  const next = buttons[buttons.indexOf(event.target) + move];
  event.preventDefault();
  if (!next) return;
  event.target.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
}

function CustomColor({ color, pick }: Pick<PickerProps, 'color' | 'pick'>) {
  const input = useRef<HTMLInputElement>(null);
  const choose = () => {
    const field = input.current;
    if (!field?.reportValidity()) return;
    pick('#' + field.value.replace(/^#/, '').toLowerCase());
  };
  return h(
    'div',
    { className: 'arc-color-custom' },
    h(
      'label',
      null,
      'Custom hex color',
      h('input', {
        ref: input,
        defaultValue: color,
        pattern: '#?[0-9a-fA-F]{6}',
        required: true,
        form: '',
        spellCheck: false,
        autoComplete: 'off',
        title: 'Enter a six-digit hex color.',
        onKeyDown: (event) => confirmWithEnter(event, choose),
      }),
    ),
    h('button', { type: 'button', className: 'arc-button', onClick: choose }, 'Use color'),
  );
}

function confirmWithEnter(event: KeyboardEvent, choose: () => void) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  choose();
}
