import { createElement as h } from 'react';
import { DialogButton, Readouts, WorkspaceLink } from '../../../../packages/ui/src/index.js';
import { CommitLink } from './github-links.js';
import { guideType } from './guide.js';
import { usePlanFile } from './plan-file-scope.js';

/** Identify the file route and expose recorded Git information on demand. */
export function FileBreadcrumbs() {
  const { route, revision, fileRevision, project } = usePlanFile();
  if (!route) return null;
  return h(
    'div',
    { className: 'arc-file-breadcrumbs' },
    h(
      'nav',
      { 'aria-label': 'Breadcrumb' },
      h(WorkspaceLink, { href: '/plan/' }, 'Plan'),
      h('span', { 'aria-hidden': true }, ' / '),
      h('span', { 'aria-current': 'page' }, guideType(route.kind)),
    ),
    h(DialogButton, {
      icon: 'info',
      title: 'Git information',
      children: h(Readouts, {
        values: [
          ['File type', guideType(route.kind)],
          ['File revision', h(CommitLink, { revision: fileRevision, remote: project?.remote })],
          ['Repository capture', h(CommitLink, { revision, remote: project?.remote })],
        ],
      }),
    }),
  );
}
