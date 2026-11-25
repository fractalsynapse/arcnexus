import { createElement as h } from 'react';
import type { AnchorHTMLAttributes } from 'react';

/** Preserve the current workspace when following an external reference. */
export function ExternalLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return h('a', { ...props, target: '_blank', rel: 'noopener noreferrer' });
}
