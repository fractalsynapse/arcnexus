import { createElement as h } from 'react';
import brandMark from '../../../assets/brain.webp';
import wordmark from '../../../assets/wordmark.webp';
import { WorkspaceLink } from '../../controls/workspace-link.js';

export function Brand({ home }: { home: string }) {
  return h(
    WorkspaceLink,
    {
      className: 'arc-brand',
      href: home,
      'aria-label': 'ArcNexus home',
    },
    h('img', { src: brandMark, width: 24, height: 24, alt: '' }),
    h('img', { src: wordmark, width: 108, alt: 'ArcNexus' }),
  );
}
