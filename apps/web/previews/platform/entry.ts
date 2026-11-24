import { createElement as h } from 'react';
import type { Context } from 'cordis';
import { mountWeb } from '../../src/composition.js';
import { ProjectContext } from './active-project.js';
import { ConnectionManager } from './connection-manager.js';
import { ProjectManager } from './project-manager.js';
import './platform.css';

const showProviders = new URLSearchParams(location.search).get('providers') === 'sample';

const root = document.getElementById('app');
if (!root) throw new Error('Platform preview root is missing');
await mountWeb(root, undefined, {
  inject: ['ui'],
  /** Contribute preview controls to the regular application frame. */
  apply(context: Context) {
    context.effect(() =>
      context.ui.registerHeaderControl('connections', h(ConnectionManager, { showProviders })),
    );
    context.effect(() => context.ui.registerHeaderControl('projects', h(ProjectManager)));
    context.effect(() => context.ui.registerWorkspaceContext(h(ProjectContext)));
  },
});
