import type { ReactNode } from 'react';
import type { ColumnCount } from '../layouts/panels/presets/index.js';

export interface DisplayRegistration {
  id: string;
  label: string;
  content: ReactNode;
  defaultColumn?: number;
}

export interface Workspace {
  path: string;
  label: string;
  content?: ReactNode;
  headerAction?: ReactNode;
  defaultColumns?: ColumnCount;
  displays?: readonly DisplayRegistration[];
}
