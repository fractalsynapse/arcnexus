import { createElement as h, useLayoutEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { IconButton } from './controls.js';
import { PageSettings } from './page-settings.js';
import { loadLayout, saveLayout, type PagePreferences } from './page-preferences.js';
import { PanelLayout } from './panel-layout.js';
import type { Workspace } from './types.js';

/** Keep every workspace on the same heading, settings and display layout. */
export function PageLayout({ workspace, path }: { workspace: Workspace; path: string }) {
  const page = usePageLayout(workspace, path);
  const { heading, gear, settings, toggle, title, panels, preferences, close, save } = page;
  return h(
    'main',
    { className: 'arc-main' },
    h(PageHeading, { label: workspace.label, title, heading, gear, settings, toggle }),
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

function PageHeading({
  label,
  title,
  heading,
  gear,
  settings,
  toggle,
}: {
  label: string;
  title: string;
  heading: Ref<HTMLHeadingElement>;
  gear: Ref<HTMLButtonElement>;
  settings: boolean;
  toggle: () => void;
}) {
  return h(
    'div',
    { className: 'arc-page-heading' },
    h(IconButton, {
      icon: 'settings',
      label: title,
      ref: gear,
      'aria-expanded': settings,
      onClick: toggle,
    }),
    h('h1', { ref: heading, tabIndex: -1 }, label),
  );
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
