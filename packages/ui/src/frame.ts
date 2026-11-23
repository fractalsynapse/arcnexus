import { createElement as h, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import brandMark from '../assets/brain.webp';
import wordmark from '../assets/wordmark.webp';
import { CommandPanel } from './command-panel.js';
import { ColorSchemes } from './schemes.js';
import { Dialog, IconButton } from './controls.js';
import { themeStyle, useTheme } from './theme.js';
import type { CommandBinding, Workspace } from './types.js';

type Navigate = (event: MouseEvent<HTMLElement>, path: string) => void;

interface FrameProps {
  workspaces: readonly Workspace[];
  commands: CommandBinding;
}

/** Compose the reusable navigation, theme, workspace region and command dock. */
export function WebFrame({ workspaces, commands }: FrameProps) {
  const [path, navigate] = useWorkspacePath();
  const theme = useTheme();
  const [schemes, setSchemes] = useState(false);
  const home = workspaces[0];
  const workspace = workspaces.find((item) => item.path === path) ?? home;
  if (!home || !workspace) throw new Error('The web frame requires a registered home workspace.');
  return h(
    'div',
    { className: 'arc-app', style: themeStyle(theme.current, theme.defaultColors) },
    h(Header, {
      home: home.path,
      navigate,
      action: workspace.headerAction,
      openSchemes: () => setSchemes(true),
    }),
    h(Navigation, { workspaces, active: workspace.path, navigate }),
    h(PageLayout, { workspace, path }),
    h(CommandPanel, { binding: commands, workspace: workspace.path }),
    h(
      Dialog,
      { title: 'Color schemes', open: schemes, onClose: () => setSchemes(false) },
      h(ColorSchemes, { theme }),
    ),
  );
}

interface HeaderProps {
  home: string;
  navigate: Navigate;
  action?: ReactNode;
  openSchemes: () => void;
}

function Header({ home, navigate, action, openSchemes }: HeaderProps) {
  return h(
    'header',
    { className: 'arc-header' },
    h(Brand, { home, navigate }),
    h(
      'div',
      { className: 'arc-header-actions' },
      h(IconButton, {
        icon: 'palette',
        label: 'Color schemes',
        'aria-haspopup': 'dialog',
        onClick: openSchemes,
      }),
      action,
    ),
  );
}

function Brand({ home, navigate }: { home: string; navigate: Navigate }) {
  return h(
    'a',
    {
      className: 'arc-brand',
      href: home,
      'aria-label': 'ArcNexus home',
      onClick: (event) => navigate(event, home),
    },
    h('img', { src: brandMark, width: 24, height: 24, alt: '' }),
    h('img', { src: wordmark, width: 108, alt: 'ArcNexus' }),
  );
}

function Navigation({
  workspaces,
  active,
  navigate,
}: {
  workspaces: readonly Workspace[];
  active: string;
  navigate: Navigate;
}) {
  return h(
    'nav',
    { className: 'arc-nav', 'aria-label': 'Workspace' },
    workspaces.map(({ path, label }) =>
      h(
        'a',
        {
          key: path,
          href: path,
          'aria-current': path === active ? 'page' : undefined,
          onClick: (event) => navigate(event, path),
        },
        label,
      ),
    ),
  );
}

/** Focus the destination heading while retaining normal anchor behavior for modified clicks. */
export function PageLayout({ workspace, path }: { workspace: Workspace; path: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    document.title = workspace.label + ' · ArcNexus';
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [path, workspace.label]);
  return h(
    'main',
    { className: 'arc-main' },
    h('h1', { ref: heading, tabIndex: -1 }, workspace.label),
    workspace.content,
  );
}

function useWorkspacePath(): [string, Navigate] {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return [
    path,
    (event, destination) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      event.preventDefault();
      if (destination === path) return window.scrollTo(0, 0);
      window.history.pushState(null, '', destination);
      setPath(destination);
    },
  ];
}
