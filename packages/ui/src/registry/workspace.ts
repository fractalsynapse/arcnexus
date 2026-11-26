import type { ComponentType, PropsWithChildren, ReactNode } from 'react';
import type { ColumnCount, PanelRegion } from '../layouts/panels/presets/index.js';
import type { TabSection } from '../controls/tabs.js';

export interface DisplayRegistration {
  id: string;
  label: string;
  content: ReactNode;
  defaultRegion?: PanelRegion;
}

export interface Workspace {
  path: string;
  label: string;
  titleAction?: ReactNode;
  content?: ReactNode;
  sections?: readonly TabSection[];
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
