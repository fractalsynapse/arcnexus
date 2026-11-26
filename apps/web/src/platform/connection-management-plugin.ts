import { createElement as h } from 'react';
import type { Context } from 'cordis';
import { ConnectionManager } from './connection-manager.js';

export const connectionManagementPlugin = {
  inject: ['ui'],
  /** Register the capacity provider controls for this platform composition. */
  apply(context: Context) {
    context.effect(() => context.ui.registerHeaderControl('connections', h(ConnectionManager)));
  },
};
