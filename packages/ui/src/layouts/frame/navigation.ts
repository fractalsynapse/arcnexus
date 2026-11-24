import { createElement as h } from 'react';
import type { Workspace } from '../../registry/workspace.js';
import type { Navigate } from './use-workspace-path.js';

export function Navigation({
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
