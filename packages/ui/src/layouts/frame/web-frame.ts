import { useSyncExternalStore, createElement as h } from 'react';
import type { CommandBinding } from '../../commands/command-binding.js';
import { CommandPanel } from '../../commands/command-panel.js';
import type { UiRegistry } from '../../registry/ui-registry.js';
import { ColorSchemes } from '../../theme/schemes/color-schemes.js';
import { themeStyle } from '../../theme/theme-colors.js';
import { useTheme } from '../../theme/theme-preferences.js';
import { PageLayout } from '../page/page-layout.js';
import { Header } from './header.js';
import { Navigation } from './navigation.js';
import { useWorkspacePath } from './use-workspace-path.js';

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
  const home = workspaces[0];
  const workspace = workspaces.find((item) => item.path === path) ?? home;
  if (!home || !workspace) return null;
  return h(
    'div',
    {
      className: 'arc-app',
      'data-header-controls': controls.length ? '' : undefined,
      style: themeStyle(theme.current, theme.defaultColors),
    },
    h(Header, {
      home: home.path,
      navigate,
      action: workspace.headerAction,
      controls,
      schemes: h(ColorSchemes, { theme }),
    }),
    h(Navigation, { workspaces, active: workspace.path, navigate }),
    h(PageLayout, { key: workspace.path, workspace, path, context }),
    h(CommandPanel, { binding: commands, workspace: workspace.path }),
  );
}
