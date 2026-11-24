import { colorFields } from '../theme-preferences.js';

export const families = {
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

export const shades = Object.values(families).flat();

export type ColorField = (typeof colorFields)[number];

export const titles = {
  background: 'Background color',
  text: 'Text color',
  accent: 'Accent color',
};

export interface PickerProps {
  field: ColorField;
  color: string;
  pick: (color: string) => void;
}
