import { createElement as h, useRef, useState, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import type { Workspace } from '../../registry/workspace.js';
import { PageSettings } from '../../settings/page/page-settings.js';
import { PanelLayout } from '../panels/panel-layout.js';
import { PageHeading } from './page-heading.js';
import { loadLayout, saveLayout } from './page-preferences.js';
import type { PagePreferences } from './page-preferences.js';

interface PageLayoutProps {
  workspace: Workspace;
  path: string;
  context?: ReactNode;
}

/** Keep every workspace on the same heading, settings and display layout. */
export function PageLayout({ workspace, path, context }: PageLayoutProps) {
  const page = usePageLayout(workspace, path);
  const { heading, gear, settings, toggle, title, panels, preferences, close, save } = page;
  return h(
    'main',
    { className: 'arc-main' },
    h(PageHeading, { label: workspace.label, title, heading, gear, settings, toggle, context }),
    settings &&
      h(PageSettings, {
        title,
        panels,
        preferences,
        close,
        save: (value) => {
          save(value);
          close();
        },
      }),
    h(
      'div',
      { hidden: settings },
      workspace.content,
      h(PanelLayout, { panels, preferences, resize: (widths) => save({ ...preferences, widths }) }),
    ),
  );
}

function usePageLayout(workspace: Workspace, path: string) {
  const heading = useRef<HTMLHeadingElement>(null);
  const gear = useRef<HTMLButtonElement>(null);
  const [settings, open] = useState(false);
  const [preferences, update] = useState(() => loadLayout(workspace));
  usePageFocus(heading, workspace.label, path);
  const close = () => {
    open(false);
    gear.current?.focus({ preventScroll: true });
  };
  const save = (value: PagePreferences) => {
    update(value);
    saveLayout(workspace.path, value);
  };
  return {
    title: workspace.label + ' page settings',
    panels: workspace.displays ?? [],
    heading,
    gear,
    settings,
    toggle: () => open(!settings),
    preferences,
    close,
    save,
  };
}

function usePageFocus(
  heading: { current: HTMLHeadingElement | null },
  label: string,
  path: string,
) {
  useLayoutEffect(() => {
    document.title = label + ' · ArcNexus';
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [heading, label, path]);
}
