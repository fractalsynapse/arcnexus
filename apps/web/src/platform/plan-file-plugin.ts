import { createElement as h } from 'react';
import type { Context } from 'cordis';
import { FileBreadcrumbs } from './file-breadcrumbs.js';
import { FileChanges } from './file-changes.js';
import { FileContent } from './file-content.js';
import { FileInformation } from './file-information.js';
import { FileToolbar } from './file-toolbar.js';
import { guideRoute, planFilesPath } from './guide.js';
import { PlanFileScope } from './plan-file-scope.js';

export const planFilePlugin = {
  inject: ['ui', 'webCommands'],
  /** Compose the dedicated file route from the same registry and panel shells. */
  apply(context: Context) {
    context.effect(() =>
      context.ui.register({
        path: planFilesPath,
        parent: '/plan/',
        label: 'Plan file',
        defaultColumns: 2,
        match: (path) => !!guideRoute(path),
        title: (path) => guideRoute(path)?.id ?? 'Plan file',
        scope: PlanFileScope,
        breadcrumbs: h(FileBreadcrumbs),
        content: h(FileToolbar, { binding: context.webCommands }),
      }),
    );
    for (const display of fileDisplays)
      context.effect(() => context.ui.registerDisplay(planFilesPath, display));
  },
};

const fileDisplays = [
  { id: 'information', label: 'File information', content: h(FileInformation), fullWidth: true },
  { id: 'content', label: 'Content', content: h(FileContent) },
  { id: 'changes', label: 'Changes', content: h(FileChanges), defaultColumn: 1 },
];
