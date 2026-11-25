import { createElement as h, useRef, useState, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import type { Workspace } from '../../registry/workspace.js';
import { PageSettings } from '../../settings/page/page-settings.js';
import { PanelLayout } from '../panels/panel-layout.js';
import { PageHeading } from './page-heading.js';
import { useLayoutPreference } from './page-preferences.js';

interface PageLayoutProps {
  workspace: Workspace;
  path: string;
  context?: ReactNode;
}

/** Keep every workspace on the same heading, settings and display layout. */
export function PageLayout({ workspace, path, context }: PageLayoutProps) {
  const page = usePageLayout(workspace, path);
  const { heading, gear, settings, toggle, title, label } = page;
  const titleRow = h(PageHeading, {
    label,
    title,
    heading,
    gear,
    settings,
    toggle,
    titleAction: workspace.titleAction,
    context: workspace.context ?? context,
  });
  return h(
    'main',
    { className: 'arc-main' },
    h('header', { className: 'arc-page-header' }, workspace.breadcrumbs, titleRow),
    settings && h(PageAppearance, { page }),
    h(PageDisplays, { workspace, page }),
  );
}

function PageAppearance({ page }: { page: ReturnType<typeof usePageLayout> }) {
  const { title, panels, preferences, close, save } = page;
  return h(PageSettings, {
    title,
    panels,
    preferences,
    close,
    save: async (value) => {
      if (await save(value)) close();
    },
  });
}

function usePageLayout(workspace: Workspace, path: string) {
  const heading = useRef<HTMLHeadingElement>(null);
  const gear = useRef<HTMLButtonElement>(null);
  const [settings, open] = useState(false);
  const { ready, preferences, save } = useLayoutPreference(workspace);
  const label = workspace.title?.(path) ?? workspace.label;
  usePageFocus(heading, label, path);
  const close = () => {
    open(false);
    gear.current?.focus({ preventScroll: true });
  };
  return {
    title: workspace.label + ' page settings',
    label,
    panels: workspace.displays ?? [],
    heading,
    gear,
    settings,
    toggle: () => ready && open(!settings),
    ready,
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

function PageDisplays({
  workspace,
  page,
}: {
  workspace: Workspace;
  page: ReturnType<typeof usePageLayout>;
}) {
  const { settings, panels, preferences, save } = page;
  return h(
    'div',
    { hidden: settings },
    workspace.content,
    page.ready &&
      h(PanelLayout, {
        workspace: workspace.path,
        panels,
        preferences,
        resize: (widths) => save({ ...preferences, widths }),
      }),
  );
}
