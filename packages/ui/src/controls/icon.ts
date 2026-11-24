import { createElement as h } from 'react';

const glyphs = {
  settings:
    'M10 2h4l.6 3 2 .9L19.3 4.4l2 3.5-2.2 2v4.2l2.2 2-2 3.5-2.7-1.5-2 .9-.6 3h-4l-.6-3-2-.9-2.7 1.5-2-3.5 2.2-2V9.9l-2.2-2 2-3.5 2.7 1.5 2-.9zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6',
  palette:
    'M12 3a9 9 0 1 0 0 18h1a1.8 1.8 0 0 0 1.3-3c-.9-1-.3-2.5 1.1-2.5H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3ZM7 11h1m3-4h1m3 2h1',
  metrics: 'M5 19v-5m7 5V5m7 14v-9',
  send: 'M7 4l13 8-13 8z',
  down: 'm5 9 7 7 7-7',
  up: 'm5 15 7-7 7 7',
  close: 'm6 6 12 12M18 6 6 18',
  refine: 'M20 10a8 8 0 1 0-2 8M20 5v5h-5',
  computer: 'M4 4h16v12H4zM12 16v4m-4 0h8',
  folder: 'M3 7V5h6l2 3h10v11H3z',
  info: 'M12 11v6m0-10h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
};

export type IconName = keyof typeof glyphs;

/** Render a consistently sized icon inside its labeled control. */
export function Icon({ name }: { name: IconName }) {
  return h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: 18,
      height: 18,
      'aria-hidden': true,
      fill: name === 'send' ? 'currentColor' : 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    h('path', { d: glyphs[name] }),
  );
}
