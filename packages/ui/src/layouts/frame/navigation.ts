import { createElement as h } from 'react';
import type { Workspace } from '../../registry/workspace.js';
import { WorkspaceLink } from '../../controls/workspace-link.js';

export function Navigation({
  workspaces,
  active,
}: {
  workspaces: readonly Workspace[];
  active: string;
}) {
  return h(
    'nav',
    { className: 'arc-nav', 'aria-label': 'Workspace' },
    workspaces.map(({ path, label }) =>
      h(
        WorkspaceLink,
        {
          key: path,
          href: path,
          'aria-current': path === active ? 'page' : undefined,
        },
        label,
      ),
    ),
  );
}
