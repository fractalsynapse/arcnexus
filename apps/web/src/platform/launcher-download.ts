import { createElement as h } from 'react';
import type { LauncherBuild } from '../../../launcher/src/targets.js';
import { Button } from '../../../../packages/ui/src/index.js';

/** Offer a direct download only for an artifact advertised by this deployment. */
export function LauncherDownload({ build }: { build?: LauncherBuild }) {
  if (!build) return h(Button, { disabled: true }, 'Download launcher');
  return h(
    'a',
    {
      className: 'arc-button',
      href: '/api/launcher-builds/' + build.target,
      download: true,
      title: 'SHA-256 ' + build.sha256,
    },
    'Download launcher',
  );
}
