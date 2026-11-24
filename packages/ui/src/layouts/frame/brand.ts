import { createElement as h } from 'react';
import brandMark from '../../../assets/brain.webp';
import wordmark from '../../../assets/wordmark.webp';
import type { Navigate } from './use-workspace-path.js';

export function Brand({ home, navigate }: { home: string; navigate: Navigate }) {
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
