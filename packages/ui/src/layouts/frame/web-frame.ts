import { Fragment, useSyncExternalStore, createElement as h } from 'react';
import type { CommandBinding } from '../../commands/command-binding.js';
import { CommandPanel } from '../../commands/command-panel.js';
import type { UiRegistry } from '../../registry/ui-registry.js';
import { ColorSchemes } from '../../theme/schemes/color-schemes.js';
import { themeStyle } from '../../theme/theme-colors.js';
import { useTheme } from '../../theme/theme-preferences.js';
import { themeScope } from '../../theme/theme-scope.js';
import { PageLayout } from '../page/page-layout.js';
import { Header } from './header.js';
import { Navigation } from './navigation.js';
import { useWorkspacePath } from './use-workspace-path.js';
import { workspaceRoute } from './workspace-route.js';

interface FrameProps {
  registry: UiRegistry;
  commands: CommandBinding;
}

/** Compose the reusable navigation, theme, workspace region and command dock. */
export function WebFrame({ registry, commands }: FrameProps) {
  const workspaces = useSyncExternalStore(registry.subscribe, registry.workspaces);
  const controls = useSyncExternalStore(registry.subscribe, registry.headerControls);
  const context = useSyncExternalStore(registry.subscribe, registry.workspaceContext);
  const [path, navigate] = useWorkspacePath();
  const theme = useTheme();
  const roots = workspaces.filter((item) => !item.parent);
  const home = roots[0];
  const pathname = path.split('?')[0]!;
  const workspace =
    workspaces.find((item) => item.path === pathname || item.match?.(pathname)) ?? home;
  if (!home || !workspace) return null;
  const active = workspace.parent ?? workspace.path;
  const action = workspace.headerAction ?? roots.find((item) => item.path === active)?.headerAction;
  return h(
    'div',
    {
      className: 'arc-app',
      'data-header-controls': controls.length ? '' : undefined,
      style: themeStyle(theme.current, theme.defaultColors),
    },
    h(FrameHeader, { home, navigate, action, controls, theme }),
    h(Navigation, { workspaces: roots, active, navigate }),
    h(WorkspaceRegion, { workspace, path, navigate, theme, context }),
    h(CommandPanel, { binding: commands, workspace: active }),
  );
}

function WorkspaceRegion({
  workspace,
  path,
  navigate,
  theme,
  context,
}: {
  workspace: import('../../registry/workspace.js').Workspace;
  path: string;
  navigate: ReturnType<typeof useWorkspacePath>[1];
  theme: ReturnType<typeof useTheme>;
  context: ReturnType<UiRegistry['workspaceContext']>;
}) {
  return h(
    themeScope.Provider,
    { value: theme },
    h(
      workspaceRoute.Provider,
      { value: { path, navigate } },
      h(
        workspace.scope ?? Fragment,
        null,
        h(PageLayout, { key: workspace.title ? path : workspace.path, workspace, path, context }),
      ),
    ),
  );
}

function FrameHeader({
  home,
  navigate,
  action,
  controls,
  theme,
}: {
  home: import('../../registry/workspace.js').Workspace;
  navigate: ReturnType<typeof useWorkspacePath>[1];
  action: import('react').ReactNode;
  controls: ReturnType<UiRegistry['headerControls']>;
  theme: ReturnType<typeof useTheme>;
}) {
  return h(Header, {
    home: home.path,
    navigate,
    action,
    controls,
    schemes: h(ColorSchemes, { theme }),
  });
}
