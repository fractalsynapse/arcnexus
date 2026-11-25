import { createElement as h } from 'react';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { useWorkspaceRoute } from '../layouts/frame/workspace-route.js';

/** Navigate within the frame while preserving the native link affordances. */
export function WorkspaceLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useWorkspaceRoute();
  return h('a', {
    ...props,
    href,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      props.onClick?.(event);
      if (href && !event.defaultPrevented) navigate?.(event, href);
    },
  });
}
