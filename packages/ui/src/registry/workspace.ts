import type { ComponentType, PropsWithChildren, ReactNode } from 'react';
import type { ColumnCount } from '../layouts/panels/presets/index.js';

export interface DisplayRegistration {
  id: string;
  label: string;
  content: ReactNode;
  defaultColumn?: number;
  fullWidth?: boolean;
}

export interface Workspace {
  path: string;
  label: string;
  content?: ReactNode;
  headerAction?: ReactNode;
  parent?: string;
  match?: (path: string) => boolean;
  title?: (path: string) => string;
  breadcrumbs?: ReactNode;
  context?: ReactNode;
  scope?: ComponentType<PropsWithChildren>;
  defaultColumns?: ColumnCount;
  displays?: readonly DisplayRegistration[];
}
